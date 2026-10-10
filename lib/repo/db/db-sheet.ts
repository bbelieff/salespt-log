/** Server-only DB sheet ledger. Never falls back to Sheets; migration 0008 must already exist. */
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { Meeting } from "@/types/meeting";
import { DbSheetLeadInput, DbSheetDate, DbSheetResult, type DbSheetLead, type DbSheetContext, type DbSheetChange } from "@/types/db-sheet";
import { getDbPool, dbEnabled } from "./client";
import { lockedMeetingCounts } from "./sales-meeting-counts";
export class DbSheetLinkedMeetingReadOnly extends Error { constructor(){super("예약된 업체정보와 일정은 컨택관리에서 수정해 주세요.");} }
export class DbSheetConflict extends Error { constructor(){super("DB_SHEET_CONFLICT");} }
function guard(ctx:DbSheetContext){if(!dbEnabled())throw new Error("DB unavailable");if(!ctx.spreadsheetId||!ctx.cohort||!ctx.email)throw new Error("Tenant required");}
async function transaction<T>(ctx:DbSheetContext,work:(c:PoolClient)=>Promise<T>):Promise<T>{
 guard(ctx);const c=await getDbPool().connect();
 try {await c.query("begin");await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["db-sheet:"+ctx.spreadsheetId]);const r=await work(c);await c.query("commit");return r;}
 catch(e){await c.query("rollback");throw e;}finally{c.release();}
}
async function read(c:Pick<PoolClient,"query">,ctx:DbSheetContext,id:string):Promise<DbSheetLead|null>{
 const r=await c.query("select data from db_sheet_leads where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,id]);return r.rows[0]?.data??null;
}
async function expected(c:PoolClient,ctx:DbSheetContext,id:string,revision:number):Promise<DbSheetLead>{
 const lead=await read(c,ctx,id);if(!lead||lead.revision!==revision)throw new DbSheetConflict();return lead;
}
async function persist(c:PoolClient,ctx:DbSheetContext,lead:DbSheetLead){
 const stored={...lead};delete stored.effectiveMeetingId;delete stored.meetingLineageIds; // read projection only; stable original link is persisted.
 await c.query(`insert into db_sheet_leads(spreadsheet_id,id,revision,data,meeting_id) values($1,$2,$3,$4::jsonb,$5)
 on conflict(spreadsheet_id,id) do update set revision=excluded.revision,data=excluded.data,meeting_id=excluded.meeting_id,updated_at=now()`,[ctx.spreadsheetId,lead.id,lead.revision,JSON.stringify(stored),lead.meetingId]);
 await c.query("insert into db_sheet_history(spreadsheet_id,lead_id,revision,data) values($1,$2,$3,$4::jsonb)",[ctx.spreadsheetId,lead.id,lead.revision,JSON.stringify(stored)]);
}
type Delta={date:string;channel:DbSheetLead["channel"];inflow:number;contacts:number};
async function applyDeltas(c:PoolClient,ctx:DbSheetContext,deltas:Delta[]){
 const merged=new Map<string,Delta>();for(const d of deltas){const key=d.date+":"+d.channel;const old=merged.get(key);merged.set(key,old?{...d,inflow:old.inflow+d.inflow,contacts:old.contacts+d.contacts}:d);}
 const changed:DbSheetChange["changedSales"]=[];
 for(const [key,d] of [...merged].sort(([a],[b])=>a.localeCompare(b))){
  if(!d.inflow&&!d.contacts)continue;
  await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values($1,$2,$3,'sales',$4,$5::jsonb) on conflict(spreadsheet_id,tab,row_key) do nothing`,[ctx.cohort,ctx.email,ctx.spreadsheetId,key,JSON.stringify({date:d.date,channel:d.channel})]);
  await c.query(`update sheet_rows set payload=payload || jsonb_build_object(
   'inflow',coalesce((payload->>'inflow')::numeric,0)+$3::int,
   'contactProgress',coalesce((payload->>'contactProgress')::numeric,0)+$4::int,
   '_dbSheetInflow',coalesce((payload->>'_dbSheetInflow')::int,0)+$3::int,
   '_dbSheetContacts',coalesce((payload->>'_dbSheetContacts')::int,0)+$4::int)
   || case when $5::boolean then jsonb_build_object('production',coalesce((payload->>'inflow')::numeric,0)+$3::int) else '{}'::jsonb end,
   mirror_pending=true,updated_at=now() where spreadsheet_id=$1 and tab='sales' and row_key=$2`,[ctx.spreadsheetId,key,d.inflow,d.contacts,d.channel==='직접생산']);
  changed.push({date:d.date,channel:d.channel});
 }return changed;
}
async function contributions(c:PoolClient,ctx:DbSheetContext,lead:DbSheetLead,sign:number):Promise<Delta[]>{
 const r=await c.query("select contact_date::text as date from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,lead.id]);
 return [{date:lead.date,channel:lead.channel,inflow:sign,contacts:0},...r.rows.map((r:{date:string})=>({date:r.date,channel:lead.channel,inflow:0,contacts:sign}))];
}
function normalizePhone(value:string){const d=value.replace(/^p:/i,"").replace(/^\+82/,"0").replace(/[^0-9]/g,"");return /^01[016789]\d{8}$/.test(d)?d.replace(/^(\d{3})(\d{4})(\d{4})$/,"$1-$2-$3"):value;}
function projectMeeting(data:DbSheetLead,meeting:unknown,lineage:string[]=[]):DbSheetLead {
 if(meeting&&typeof meeting==='object'&&(meeting as {_cleared?:boolean})._cleared)return {...data,stage:"미팅 삭제됨"};
 const parsed=Meeting.safeParse(meeting);if(!parsed.success)return data;
 const m=parsed.data;const stage:Record<Meeting["상태"],string>={예약:"미팅예약",변경:"미팅변경",계약:"계약",완료:"완료",취소:"미팅취소"};
 return {...data,effectiveMeetingId:m.id,meetingLineageIds:lineage,stage:stage[m.상태],contact:{...data.contact,ci:m.업체정보??data.contact.ci,companyName:m.업체명,meetingDate:m.미팅날짜,time:m.미팅시간,place:m.장소,reservationNote:m.예약비고}};
}
type MeetingRow={row_key:string;payload:Record<string,unknown>};
function effectiveMeeting(rows:MeetingRow[],id:string|null):{meeting:unknown;lineage:string[]} {
 const seen=new Set<string>();let current=rows.find(row=>row.row_key===id);
 while(current&&!seen.has(current.row_key)){
  seen.add(current.row_key);
  const child=rows.find(row=>row.payload.previousMeetingId===current!.row_key&&!row.payload._cleared&&!seen.has(row.row_key));
  if(!child)break;current=child;
 }
 return {meeting:current?.payload,lineage:[...seen]};
}
async function meetingRows(c:Pick<PoolClient,"query">,ctx:DbSheetContext,lock=false):Promise<MeetingRow[]>{
 const r=await c.query("select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' order by updated_at desc,row_key desc"+(lock?" for update":""),[ctx.spreadsheetId]);return r.rows;
}
async function linkedProjection(c:PoolClient,ctx:DbSheetContext,old:DbSheetLead){
 const resolved=effectiveMeeting(await meetingRows(c,ctx,true),old.meetingId);
 return projectMeeting(old,resolved.meeting,resolved.lineage);
}
const linkedKeys=["ci","companyName","meetingDate","time","place","reservationNote"] as const;
async function save(c:PoolClient,ctx:DbSheetContext,raw:unknown,revision:number|null):Promise<DbSheetChange>{
 const input=DbSheetLeadInput.parse(raw);if(!["매입DB","직접생산"].includes(input.channel))throw new Error("Unsupported import channel");
 const old=await read(c,ctx,input.id);if(revision===null?!!old:!old||old.revision!==revision)throw new DbSheetConflict();
 let current=old;
 if(old?.meetingId){
  current=await linkedProjection(c,ctx,old);
  if(linkedKeys.some(key=>canonical(input.contact[key])!==canonical(current!.contact[key])))throw new DbSheetLinkedMeetingReadOnly();
 }
 const lead:DbSheetLead={...input,phone:normalizePhone(input.phone),contact:{...input.contact,registered:old?.contact.registered??false},revision:(old?.revision??0)+1,result:old?.result??"미컨택",first:old?.first??"",stage:current?.stage??"미컨택",meetingId:old?.meetingId??null};
 // Once a meeting owns its channel, changes must follow the meeting editor contract.
 if(old?.meetingId&&old.channel!==lead.channel)throw new Error("Linked meeting channel cannot change here");
 const before=old?await contributions(c,ctx,old,-1):[];await persist(c,ctx,lead);
 return {lead,changedSales:await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)])};
}
/** Linked Meeting is the authoritative verified company/schedule snapshot; never rewrites raw DB source. */
export async function listDbSheet(ctx:DbSheetContext):Promise<DbSheetLead[]>{
 guard(ctx);const c=getDbPool();const r=await c.query("select data from db_sheet_leads where spreadsheet_id=$1 order by data->>'date' desc,id",[ctx.spreadsheetId]);
 const meetings=await meetingRows(c,ctx);
 return r.rows.map(({data}:{data:DbSheetLead})=>{const resolved=effectiveMeeting(meetings,data.meetingId);return projectMeeting(data,resolved.meeting,resolved.lineage);});
}
export async function saveDbSheetLead(ctx:DbSheetContext,input:unknown,expectedRevision:number|null){return transaction(ctx,c=>save(c,ctx,input,expectedRevision));}
export async function saveDbSheetContact(ctx:DbSheetContext,leadId:string,input:{date:string;result:string;note:string},expectedRevision:number){
 z.string().uuid().parse(leadId);const event=z.object({date:DbSheetDate,result:DbSheetResult,note:z.string().max(20000)}).parse(input);
 return transaction(ctx,async c=>{
 const stored=await expected(c,ctx,leadId,expectedRevision);const old=stored.meetingId?await linkedProjection(c,ctx,stored):stored;const before=await contributions(c,ctx,old,-1);
 const qualified=["컨택진행","상담 후 거절"].includes(event.result);
 await c.query(`insert into db_sheet_contacts(spreadsheet_id,lead_id,contact_date,qualified,result,note) values($1,$2,$3,$4,$5,$6)
 on conflict(spreadsheet_id,lead_id,contact_date) do update set qualified=db_sheet_contacts.qualified or excluded.qualified,result=excluded.result,note=excluded.note`,[ctx.spreadsheetId,leadId,event.date,qualified,event.result,event.note]);
 const dates=await c.query("select min(contact_date)::text as first from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,leadId]);
 const first=dates.rows[0]?.first??"";const lead:DbSheetLead={...old,revision:old.revision+1,result:event.result,first,stage:old.meetingId?old.stage:first?"상담 중":"미컨택",contact:{...old.contact,date:event.date,note:event.note}};
 await persist(c,ctx,lead);return {lead,changedSales:await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)])};
 });
}
export async function registerDbSheetMeeting(ctx:DbSheetContext,leadId:string,raw:Meeting,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);
 return transaction(ctx,async c=>{
 const old=await expected(c,ctx,leadId,expectedRevision);if(old.meetingId)return {lead:await linkedProjection(c,ctx,old),changedSales:[],meetingId:old.meetingId};
 const meeting=Meeting.parse({...raw,id:randomUUID(),channel:old.channel});DbSheetDate.parse(meeting.예약일);DbSheetDate.parse(meeting.미팅날짜);
 const before=await contributions(c,ctx,old,-1);
 await c.query(`insert into db_sheet_contacts(spreadsheet_id,lead_id,contact_date,qualified,result,note) values($1,$2,$3,true,'컨택진행',$4)
 on conflict(spreadsheet_id,lead_id,contact_date) do update set qualified=true,result='컨택진행'`,[ctx.spreadsheetId,leadId,meeting.예약일,old.contact.note]);
 const dates=await c.query("select min(contact_date)::text as first from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,leadId]);
 await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'meetings',$4,$5::jsonb,true)`,[ctx.cohort,ctx.email,ctx.spreadsheetId,meeting.id,JSON.stringify(meeting)]);
 const lead:DbSheetLead={...old,revision:old.revision+1,result:"컨택진행",first:dates.rows[0].first,stage:"미팅예약",meetingId:meeting.id,contact:{...old.contact,registered:true,date:meeting.예약일,ci:meeting.업체정보??old.contact.ci,companyName:meeting.업체명,reservationNote:meeting.예약비고,meetingDate:meeting.미팅날짜,time:meeting.미팅시간,place:meeting.장소}};
 await persist(c,ctx,lead);
 const count=(await lockedMeetingCounts(c,ctx.spreadsheetId)).get(meeting.예약일+":"+old.channel)??0;
 await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true)
 on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload || jsonb_build_object('meetingReservation',(excluded.payload->>'meetingReservation')::int),mirror_pending=true,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,meeting.예약일+":"+old.channel,JSON.stringify({date:meeting.예약일,channel:old.channel,meetingReservation:count})]);
 const changedSales=await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)]);
 if(!changedSales.some(x=>x.date===meeting.예약일&&x.channel===old.channel))changedSales.push({date:meeting.예약일,channel:old.channel});
 return {lead,changedSales,meetingId:meeting.id};
 });
}
function canonical(v:unknown):string{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';return JSON.stringify(v);}
export async function importDbSheetLeads(ctx:DbSheetContext,batchId:string,inputs:unknown[]):Promise<DbSheetChange[]>{
 z.string().uuid().parse(batchId);const parsed=z.array(DbSheetLeadInput).min(1).max(500).parse(inputs);const digest=createHash('sha256').update(canonical(parsed)).digest('hex');
 return transaction(ctx,async c=>{
 const r=await c.query('select digest,lead_ids from db_sheet_imports where spreadsheet_id=$1 and batch_id=$2',[ctx.spreadsheetId,batchId]);
 if(r.rows[0]){if(r.rows[0].digest!==digest)throw new DbSheetConflict();return Promise.all(r.rows[0].lead_ids.map(async(id:string)=>{const lead=(await read(c,ctx,id))!;return {lead:lead.meetingId?await linkedProjection(c,ctx,lead):lead,changedSales:[]};}));}
 const result:DbSheetChange[]=[];for(const input of parsed)result.push(await save(c,ctx,input,null));
 await c.query('insert into db_sheet_imports(spreadsheet_id,batch_id,digest,lead_ids) values($1,$2,$3,$4::jsonb)',[ctx.spreadsheetId,batchId,digest,JSON.stringify(parsed.map(x=>x.id))]);return result;
 });
}
