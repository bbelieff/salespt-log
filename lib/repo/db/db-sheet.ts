/** Server-only DB sheet ledger. Never falls back to Sheets; migration 0008 must already exist. */
import { formatMobilePhone } from "@/util/db-sheet-identity";
import { addDays, fmtISO, parseISO, todayKST } from "@/util/week";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { Meeting } from "@/types/meeting";
import { DbSheetLeadInput, DbSheetDate, DbSheetResult, DbSheetManualStage, isQualifiedDbSheetContact, nextDbSheetFirstContact, dbSheetContactStage, autoDbSheetNextContact, DB_SHEET_MEETING_STAGE, DB_SHEET_MEETING_DELETED, type DbSheetLead, type DbSheetContext, type DbSheetChange } from "@/types/db-sheet";
import { getDbPool, dbEnabled } from "./client";
import {hydrateRecording,settleRecording,withInflowStatus,recordedInflow,inflowBlockReason,contributionImpact,meetingImpact,DbSheetOperationBlocked} from "./db-sheet-recording";
export {DbSheetOperationBlocked} from './db-sheet-recording';
import { assertNotDuplicate } from "./db-sheet-safety";
export {DbSheetDuplicate} from "./db-sheet-safety";
import { lockedMeetingCounts } from "./sales-meeting-counts";
export class DbSheetLinkedMeetingReadOnly extends Error { constructor(){super("예약된 업체정보와 일정은 STEP 3 일정·계약에서 수정해 주세요.");} }
export class DbSheetConflict extends Error { constructor(){super("DB_SHEET_CONFLICT");} }
function guard(ctx:DbSheetContext){if(!dbEnabled())throw new Error("DB unavailable");if(!ctx.spreadsheetId||!ctx.cohort||!ctx.email)throw new Error("Tenant required");}
async function transaction<T>(ctx:DbSheetContext,work:(c:PoolClient)=>Promise<T>):Promise<T>{
 guard(ctx);const c=await getDbPool().connect();
 try {await c.query("begin");await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["db-sheet:"+ctx.spreadsheetId]);const r=await work(c);await c.query("commit");return r;}
 catch(e){await c.query("rollback");throw e;}finally{c.release();}
}
async function read(c:Pick<PoolClient,"query">,ctx:DbSheetContext,id:string):Promise<DbSheetLead|null>{
 const r=await c.query("select data from db_sheet_leads where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,id]);return r.rows[0]?.data?hydrateRecording(c,ctx,r.rows[0].data):null;
}
async function expected(c:PoolClient,ctx:DbSheetContext,id:string,revision:number):Promise<DbSheetLead>{
 const lead=await read(c,ctx,id);if(!lead||lead.revision!==revision)throw new DbSheetConflict();return lead;
}
async function persist(c:PoolClient,ctx:DbSheetContext,lead:DbSheetLead){
 await settleRecording(c,ctx,lead);const stored={...lead};delete stored.inflowStatus;delete stored.effectiveMeetingId;delete stored.meetingLineageIds;delete stored.funnel; // read projection only; stable original link is persisted.
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
 const recorded=lead._recorded;
 return [...(recorded?.inflow?[{date:lead.date,channel:lead.channel,inflow:sign,contacts:0}]:[]),...(recorded?.contacts??[]).map(date=>({date,channel:lead.channel,inflow:0,contacts:sign}))];
}
function projectMeeting(data:DbSheetLead,meeting:unknown,lineage:string[]=[]):DbSheetLead {
 if(meeting&&typeof meeting==='object'&&(meeting as {_cleared?:boolean})._cleared)return {...data,stage:DB_SHEET_MEETING_DELETED};
 const parsed=Meeting.safeParse(meeting);if(!parsed.success)return data;
 const m=parsed.data;
 return {...data,effectiveMeetingId:m.id,meetingLineageIds:lineage,stage:DB_SHEET_MEETING_STAGE[m.상태],contact:{...data.contact,ci:m.업체정보??data.contact.ci,companyName:m.업체명,meetingDate:m.미팅날짜,time:m.미팅시간,place:m.장소,reservationNote:m.예약비고}};
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
async function followUpState(c:Pick<PoolClient,"query">,ctx:DbSheetContext,lead:DbSheetLead){
 if(lead.followUp)return lead.followUp;
 const r=await c.query("select max(contact_date)::text as date from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,lead.id]);
 return {generation:0,completedGeneration:null,lastContactDate:r.rows[0]?.date??""};
}
const linkedKeys=["ci","companyName","meetingDate","time","place","reservationNote"] as const;
async function save(c:PoolClient,ctx:DbSheetContext,raw:unknown,revision:number|null,scheduleNext=false,allowDuplicate=false):Promise<DbSheetChange>{
 const input=DbSheetLeadInput.parse(raw);
 const old=await read(c,ctx,input.id);if(revision===null?!!old:!old||old.revision!==revision)throw new DbSheetConflict();
 if(!old&&!allowDuplicate)await assertNotDuplicate(c,ctx,input);
 if(old)old.followUp=await followUpState(c,ctx,old);
 let current=old;
 if(old?.meetingId){
  current=await linkedProjection(c,ctx,old);
  if(linkedKeys.some(key=>canonical(input.contact[key])!==canonical(current!.contact[key])))throw new DbSheetLinkedMeetingReadOnly();
 }
 const lead:DbSheetLead={...input,asReceived:input.asReceived??old?.asReceived??false,asNote:input.asNote??old?.asNote??"",firstManual:old?.firstManual??false,recording:old?.recording??input.recording??{inflow:true,activities:true},_recorded:old?structuredClone(old._recorded):{inflow:false,contacts:[],meeting:false},next:old&&!scheduleNext?old.next:input.next,phone:formatMobilePhone(input.phone),contact:{...input.contact,registered:old?.contact.registered??false},revision:(old?.revision??0)+1,result:old?.result??"미컨택",first:old?.first??"",hasQualifiedContact:old?.hasQualifiedContact??!!old?.first,stage:current?.stage??"미컨택",meetingId:old?.meetingId??null,...(old?.manualStage?{manualStage:old.manualStage}:{}),
  followUp:{generation:(old?.followUp?.generation??0)+(old&&scheduleNext?1:0),completedGeneration:old?.followUp?.completedGeneration??null,lastContactDate:old?.followUp?.lastContactDate??""},
  // Response-only lineage (persist strips it): lets the status projector match a contract linked to a rescheduled child meeting.
  ...(current?.effectiveMeetingId?{effectiveMeetingId:current.effectiveMeetingId,meetingLineageIds:current.meetingLineageIds??[]}:{})};
 // Once a meeting owns its channel, changes must follow the meeting editor contract.
 if(old?.meetingId&&old.channel!==lead.channel)throw new Error("Linked meeting channel cannot change here");
 const before=old?await contributions(c,ctx,old,-1):[];await persist(c,ctx,lead);
 return {lead,impact:contributionImpact(old,lead),changedSales:await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)])};
}
/** Linked Meeting is the authoritative verified company/schedule snapshot; never rewrites raw DB source. */
export async function listDbSheet(ctx:DbSheetContext):Promise<DbSheetLead[]>{
 guard(ctx);const c=getDbPool();const r=await c.query("select data from db_sheet_leads where spreadsheet_id=$1 order by data->>'date' desc,id",[ctx.spreadsheetId]);
 const meetings=await meetingRows(c,ctx);
 const contacts=await c.query("select lead_id,max(contact_date)::text as date,array_agg(contact_date::text) filter (where qualified) as qualified_dates from db_sheet_contacts where spreadsheet_id=$1 group by lead_id",[ctx.spreadsheetId]);
 const lastDates=new Map(contacts.rows.map((row:{lead_id:string;date:string})=>[row.lead_id,row.date]));
 const history=await c.query('select lead_id from db_sheet_history where spreadsheet_id=$1 and revision=1',[ctx.spreadsheetId]);const evidence=new Set(history.rows.map((r:{lead_id:string})=>r.lead_id));
 const qualified=new Map(contacts.rows.map((r:{lead_id:string;qualified_dates:string[]|null})=>[r.lead_id,r.qualified_dates??[]]));
 return r.rows.map(({data:raw}:{data:DbSheetLead})=>{
  let data:DbSheetLead;
  try{data=withInflowStatus({...raw,recording:raw.recording??{inflow:recordedInflow(raw),activities:true},_recorded:raw._recorded??{inflow:recordedInflow(raw),contacts:qualified.get(raw.id)??[],meeting:!!raw.meetingId,legacyUnknown:!evidence.has(raw.id)}});}
  catch(error){
   if(!(error instanceof DbSheetOperationBlocked))throw error;
   // List-only pure projection isolation: never keep a stale status or invent OFF. Mutations still use strict read().
   data={...raw};delete data.inflowStatus;
  }
  const resolved=effectiveMeeting(meetings,data.meetingId);
  // 현재상태는 저장값을 고치지 않고 읽을 때 컨택결과 기준으로 다시 계산한다(예전 행의 「미컨택」 표시 보정).
  if(!data.meetingId)data={...data,stage:dbSheetContactStage({...data,hasQualifiedContact:data.hasQualifiedContact??!!data.first})};
  return projectMeeting({...data,followUp:data.followUp??{generation:0,completedGeneration:null,lastContactDate:lastDates.get(data.id)??""}},resolved.meeting,resolved.lineage);
 });
}
export async function saveDbSheetLead(ctx:DbSheetContext,input:unknown,expectedRevision:number|null,scheduleNext=false,allowDuplicate=false){return transaction(ctx,c=>save(c,ctx,input,expectedRevision,scheduleNext,allowDuplicate));}
export async function saveDbSheetContact(ctx:DbSheetContext,leadId:string,input:{date:string;result:string;note:string},expectedRevision:number){
 z.string().uuid().parse(leadId);const event=z.object({date:DbSheetDate,result:DbSheetResult,note:z.string().max(20000)}).parse(input);
 return transaction(ctx,async c=>{
 const stored=await expected(c,ctx,leadId,expectedRevision);const old=stored.meetingId?await linkedProjection(c,ctx,stored):stored;old.followUp=await followUpState(c,ctx,old);const before=await contributions(c,ctx,old,-1);
 const qualified=isQualifiedDbSheetContact(event.result);
 await c.query(`insert into db_sheet_contacts(spreadsheet_id,lead_id,contact_date,qualified,result,note) values($1,$2,$3,$4,$5,$6)
 on conflict(spreadsheet_id,lead_id,contact_date) do update set qualified=db_sheet_contacts.qualified or excluded.qualified,result=excluded.result,note=excluded.note`,[ctx.spreadsheetId,leadId,event.date,qualified,event.result,event.note]);
 const dates=await c.query("select min(contact_date)::text as first from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,leadId]);
 const hasQualifiedContact=!!dates.rows[0]?.first;const first=nextDbSheetFirstContact(old.first,event.result,event.date);
 // 이 컨택이 잡혀 있던 다음 연락일을 소비하면 비운다. 부재는 빈 다음 연락일을 내일(KST)로 새로 잡는다(새 예약 세대).
 const consumed=!old.next||event.date>=old.next,generation=old.followUp?.generation??0,kept=consumed?"":old.next;
 const next=autoDbSheetNextContact(event.result,kept,fmtISO(addDays(parseISO(todayKST()),1))),scheduled=next!==kept;
 // 새 컨택결과를 기록하면 직접 정한 현재상태(장기관리·진행종료)는 풀린다 — 다시 연락을 시작했다는 뜻.
 const lead:DbSheetLead={...withoutManualStage(old),next,revision:old.revision+1,result:event.result,first,hasQualifiedContact,stage:old.meetingId?old.stage:dbSheetContactStage({stage:"",result:event.result,hasQualifiedContact}),contact:{...old.contact,date:event.date,note:event.note},followUp:{generation:generation+(scheduled?1:0),completedGeneration:consumed?generation:old.followUp?.completedGeneration??null,lastContactDate:[old.followUp?.lastContactDate??"",event.date].sort().at(-1)!}};
 await persist(c,ctx,lead);return {lead,impact:contributionImpact(old,lead),changedSales:await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)])};
 });
}
function withoutManualStage(lead:DbSheetLead):DbSheetLead{const copy={...lead};delete copy.manualStage;return copy;}
/**
 * 현재상태 직접 정하기(장기관리·진행종료·DB컨택중으로 되돌리기). 컨택결과·STEP 2 기록·다음 연락일은 그대로 둔다.
 * 미팅이 연결된 업체는 미팅 단계가 현재상태라 여기서 바꾸지 않는다.
 */
export async function setDbSheetManualStage(ctx:DbSheetContext,leadId:string,manualStage:DbSheetManualStage,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);DbSheetManualStage.parse(manualStage);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);
  if(old.meetingId)throw new DbSheetOperationBlocked("미팅이 연결된 업체는 STEP 3 일정·계약에서 상태를 바꿔 주세요.");
  const lead:DbSheetLead={...old,manualStage,stage:manualStage,revision:old.revision+1};
  await persist(c,ctx,lead);return {lead,changedSales:[]};
 });
}
/** Display date editing does not create/move contact events or STEP 2 contributions. */
export async function setDbSheetFirstDate(ctx:DbSheetContext,leadId:string,first:string,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);z.union([DbSheetDate,z.literal("")]).parse(first);
 return transaction(ctx,async c=>{
  const stored=await expected(c,ctx,leadId,expectedRevision);
  const old=stored.meetingId?await linkedProjection(c,ctx,stored):stored;
  const lead:DbSheetLead={...old,first,firstManual:first!=="",hasQualifiedContact:old.hasQualifiedContact??!!old.first,revision:old.revision+1};
  await persist(c,ctx,lead);return {lead,changedSales:[]};
 });
}
/** Explicit scheduling also reopens a reservation for the same calendar day. */
export async function scheduleDbSheetContact(ctx:DbSheetContext,leadId:string,next:string,expectedRevision:number){
 z.string().uuid().parse(leadId);z.union([DbSheetDate,z.literal("")]).parse(next);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);old.followUp=await followUpState(c,ctx,old);
  const lead:DbSheetLead={...old,next,revision:old.revision+1,followUp:{generation:(old.followUp?.generation??0)+1,completedGeneration:old.followUp?.completedGeneration??null,lastContactDate:old.followUp?.lastContactDate??""}};
  await persist(c,ctx,lead);return {lead,changedSales:[]};
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
 const lead:DbSheetLead={...withoutManualStage(old),revision:old.revision+1,result:"컨택진행",first:old.first||dates.rows[0].first,hasQualifiedContact:true,stage:"미팅예약",meetingId:meeting.id,contact:{...old.contact,registered:true,date:meeting.예약일,ci:meeting.업체정보??old.contact.ci,companyName:meeting.업체명,reservationNote:meeting.예약비고,meetingDate:meeting.미팅날짜,time:meeting.미팅시간,place:meeting.장소}};
 await persist(c,ctx,lead);
 const count=(await lockedMeetingCounts(c,ctx.spreadsheetId,true)).get(meeting.예약일+":"+old.channel)??0;
 await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true)
 on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload || jsonb_build_object('meetingReservation',(excluded.payload->>'meetingReservation')::int),mirror_pending=true,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,meeting.예약일+":"+old.channel,JSON.stringify({date:meeting.예약일,channel:old.channel,meetingReservation:count})]);
 const changedSales=await applyDeltas(c,ctx,[...before,...await contributions(c,ctx,lead,1)]);
 if(!changedSales.some(x=>x.date===meeting.예약일&&x.channel===old.channel))changedSales.push({date:meeting.예약일,channel:old.channel});
 return {lead,changedSales,meetingId:meeting.id,impact:await meetingImpact(c,ctx,old,lead,contributionImpact(old,lead))};
 });
}
function canonical(v:unknown):string{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';return JSON.stringify(v);}
export async function importDbSheetLeads(ctx:DbSheetContext,batchId:string,inputs:unknown[],allowDuplicateIds:string[]=[]):Promise<DbSheetChange[]>{
 z.string().uuid().parse(batchId);const parsed=z.array(DbSheetLeadInput).min(1).max(500).parse(inputs);const digest=createHash('sha256').update(canonical({parsed,allowDuplicateIds:[...allowDuplicateIds].sort()})).digest('hex');const legacyDigest=parsed.every(x=>x.recording===undefined)&&!allowDuplicateIds.length?createHash('sha256').update(canonical(parsed)).digest('hex'):null;
 return transaction(ctx,async c=>{
 const r=await c.query('select digest,lead_ids from db_sheet_imports where spreadsheet_id=$1 and batch_id=$2',[ctx.spreadsheetId,batchId]);
 if(r.rows[0]){if(r.rows[0].digest!==digest&&r.rows[0].digest!==legacyDigest)throw new DbSheetConflict();return Promise.all(r.rows[0].lead_ids.map(async(id:string)=>{const lead=await read(c,ctx,id);if(!lead)throw new DbSheetConflict();return {lead:withInflowStatus(lead.meetingId?await linkedProjection(c,ctx,lead):lead),changedSales:[]};}));}
 const result:DbSheetChange[]=[];for(const input of parsed)result.push(await save(c,ctx,input,null,false,allowDuplicateIds.includes(input.id)));
 await c.query('insert into db_sheet_imports(spreadsheet_id,batch_id,digest,lead_ids) values($1,$2,$3,$4::jsonb)',[ctx.spreadsheetId,batchId,digest,JSON.stringify(parsed.map(x=>x.id))]);return result;
 });
}

/** Preview and apply use the same revision-bound ledger calculation. */
export async function changeDbSheetRecording(ctx:DbSheetContext,id:string,revision:number,recording:NonNullable<DbSheetLead['recording']>,preview=false){
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,id,revision);await settleRecording(c,ctx,old);const lead={...old,recording,revision:old.revision+1};
  await settleRecording(c,ctx,lead);const impact=await meetingImpact(c,ctx,old,lead,contributionImpact(old,lead));
  if(preview)return {lead:old,changedSales:[],impact};
  await persist(c,ctx,lead);const changedSales=await applyDeltas(c,ctx,[...await contributions(c,ctx,old,-1),...await contributions(c,ctx,lead,1)]);
  if(impact.meetings){const counts=await lockedMeetingCounts(c,ctx.spreadsheetId,true);for(const row of impact.rows.filter(x=>x.meetings)){
   const key=row.date+':'+row.channel;await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true) on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload||excluded.payload,mirror_pending=true,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,key,JSON.stringify({date:row.date,channel:row.channel,meetingReservation:counts.get(key)??0})]);changedSales.push({date:row.date,channel:row.channel});
  }}
  return {lead,changedSales,impact};
 });
}
/** Explicit reconciliation removes/adds only this lead's proven inflow contribution. */
export async function changeDbSheetInflow(ctx:DbSheetContext,id:string,revision:number,inflow:boolean,preview=false):Promise<DbSheetChange>{
 z.string().uuid().parse(id);z.boolean().parse(inflow);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,id,revision);
  const lead:DbSheetLead={...old,revision:old.revision+1,recording:{inflow,activities:old.recording?.activities??true},_recorded:{...old._recorded!,inflow}};
  const impact=contributionImpact(old,lead);
  impact.blockedReason=await inflowBlockReason(c,ctx,old,inflow);
  if(preview)return {lead:old,changedSales:[],impact};
  if(impact.blockedReason)throw new DbSheetOperationBlocked(impact.blockedReason);
  await persist(c,ctx,lead);
  return {lead,impact,changedSales:await applyDeltas(c,ctx,[...await contributions(c,ctx,old,-1),...await contributions(c,ctx,lead,1)])};
 });
}
export async function deleteDbSheetLead(ctx:DbSheetContext,id:string,revision:number,preview=false){
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,id,revision);const {deleteBlockReason}=await import('./db-sheet-safety');
  const blockedReason=await deleteBlockReason(c,ctx,old);const impact=contributionImpact(old,null);if(blockedReason)impact.blockedReason=blockedReason;
  if(preview)return {lead:old,changedSales:[],impact};
  if(blockedReason)throw new DbSheetOperationBlocked(blockedReason);
  const changedSales=await applyDeltas(c,ctx,await contributions(c,ctx,old,-1));
  await c.query('delete from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,id]);
  await c.query('delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,id]);
  await c.query('delete from db_sheet_leads where spreadsheet_id=$1 and id=$2',[ctx.spreadsheetId,id]);
  // Keep the tombstone until Sheets/Calendar convergence; permanent DB deletion forbids restoration.
  if(old.meetingId)await c.query("update sheet_rows set payload=payload||'{\"_dbSheetLeadDeleted\":true}'::jsonb,mirror_pending=true,updated_at=now() where spreadsheet_id=$1 and tab='meetings' and row_key=$2 and coalesce((payload->>'_cleared')::boolean,false)",[ctx.spreadsheetId,old.meetingId]);
  return {lead:old,changedSales,impact,meetingId:old.meetingId??undefined};
 });
}
export async function listDbSheetSuppliers(ctx:DbSheetContext){
 guard(ctx);const r=await getDbPool().query("select distinct trim(data->>'supplier') as supplier from db_sheet_history where spreadsheet_id=$1 and trim(coalesce(data->>'supplier',''))<>'' order by supplier",[ctx.spreadsheetId]);return r.rows.map((x:{supplier:string})=>x.supplier);
}
