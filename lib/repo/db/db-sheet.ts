/** Server-only DB sheet ledger. Never falls back to Sheets; migration 0008 must already exist. */
import { formatMobilePhone } from "@/util/db-sheet-identity";
import { addDays, fmtISO, parseISO } from "@/util/week";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { Meeting } from "@/types/meeting";
import { DbSheetLeadInput, DbSheetDate, DbSheetResult, DbSheetManualStage, DbSheetAbsence, isSimilarDbSheetCompany, isQualifiedDbSheetContact, DB_SHEET_QUALIFIED_RESULTS, nextDbSheetFirstContact, dbSheetContactStage, autoDbSheetNextContact, backfillDbSheetDates, DB_SHEET_MEETING_STAGE, DB_SHEET_MEETING_DELETED, type DbSheetLead, type DbSheetContext, type DbSheetTrashItem, type DbSheetChange } from "@/types/db-sheet";
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
 await settleRecording(c,ctx,lead);const stored={...lead};delete stored.inflowStatus;delete stored.effectiveMeetingId;delete stored.meetingLineageIds;delete stored.funnel;delete stored.contractRow; // read projection only; stable original link is persisted.
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
 const contacts=await c.query("select lead_id,max(contact_date)::text as date,min(contact_date) filter (where result in ('단순거절','재통화','컨택진행','상담 후 거절'))::text as first_consult,array_agg(contact_date::text) filter (where qualified) as qualified_dates,bool_or(result=any($2)) as consulted from db_sheet_contacts where spreadsheet_id=$1 group by lead_id",[ctx.spreadsheetId,[...DB_SHEET_QUALIFIED_RESULTS]]);
 const consulted=new Map(contacts.rows.map((row:{lead_id:string;consulted:boolean|null})=>[row.lead_id,row.consulted===true]));
 const firstConsult=new Map(contacts.rows.map((row:{lead_id:string;first_consult:string|null})=>[row.lead_id,row.first_consult??""]));
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
  // 「상담 중」은 기록에 실제로 남은 결과(미팅예약·컨택 후 거절)로 판정한다(2026-10-25 belie 「규칙 유지 + 표시만 분리」) — 같은 날 결과를 바꿔도
  // STEP 2 실적 표시(qualified)는 남지만, 현재상태는 마지막 결과를 따른다. 컨택 기록이 없는 옛 행만 저장값으로.
  if(!data.meetingId)data={...data,stage:dbSheetContactStage({...data,hasQualifiedContact:consulted.get(data.id)??data.hasQualifiedContact??!!data.first})};
  // 예전 기록 보정(읽을 때만): 실적 여부는 보정 전 값으로 고정한 뒤 날짜만 채운다.
  // 부재는 비어 있는 다음 연락일을 전부 채운다(2026-10-25 belie 「이미 잡혀 있는 부재 전부」). 채운 날은 아직 안 한 새 예약이다.
  {const before=data.next;data=backfillDbSheetDates({...data,hasQualifiedContact:data.hasQualifiedContact??!!data.first},lastDates.get(data.id)??"",d=>fmtISO(addDays(parseISO(d),1)),firstConsult.get(data.id)??"");
  if(data.next&&data.next!==before){const g=data.followUp?.generation??0;data={...data,followUp:{generation:g+1,completedGeneration:data.followUp?.completedGeneration??null,lastContactDate:data.followUp?.lastContactDate??lastDates.get(data.id)??""}};}}
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
 const consultedRow=await c.query("select bool_or(result=any($3)) as consulted from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,leadId,[...DB_SHEET_QUALIFIED_RESULTS]]);
 const consulted=consultedRow.rows[0]?.consulted===true;
 // 이 컨택이 잡혀 있던 다음 연락일을 소비하면 비운다. 부재는 빈 다음 연락일을 부재를 적은 날의 다음날로 새로 잡는다(새 예약 세대, 2026-10-25 belie).
 const consumed=!old.next||event.date>=old.next,generation=old.followUp?.generation??0,kept=consumed?"":old.next;
 const next=autoDbSheetNextContact(event.result,kept,fmtISO(addDays(parseISO(event.date),1))),scheduled=next!==kept;
 // 새 컨택결과를 기록하면 직접 정한 현재상태(장기관리·진행종료)는 풀린다 — 다시 연락을 시작했다는 뜻.
 const lead:DbSheetLead={...withoutManualStage(old),next,revision:old.revision+1,result:event.result,first,hasQualifiedContact,stage:old.meetingId?old.stage:dbSheetContactStage({stage:"",result:event.result,hasQualifiedContact:consulted}),contact:{...old.contact,date:event.date,note:event.note},followUp:{generation:generation+(scheduled?1:0),completedGeneration:consumed?generation:old.followUp?.completedGeneration??null,lastContactDate:[old.followUp?.lastContactDate??"",event.date].sort().at(-1)!}};
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
  // 지우기 전에 휴지통에 그대로 보관한다(되돌리기용). STEP 2 기여분은 지금 뺀다.
  await moveToTrash(c,ctx,old);
  const changedSales=await applyDeltas(c,ctx,await contributions(c,ctx,old,-1));
  await c.query('delete from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,id]);
  await c.query('delete from db_sheet_history where spreadsheet_id=$1 and lead_id=$2',[ctx.spreadsheetId,id]);
  await c.query('delete from db_sheet_leads where spreadsheet_id=$1 and id=$2',[ctx.spreadsheetId,id]);
  // Keep the tombstone until Sheets/Calendar convergence; 휴지통에서 되돌리면 표시를 지운다.
  if(old.meetingId)await c.query("update sheet_rows set payload=payload||'{\"_dbSheetLeadDeleted\":true}'::jsonb,mirror_pending=true,updated_at=now() where spreadsheet_id=$1 and tab='meetings' and row_key=$2 and coalesce((payload->>'_cleared')::boolean,false)",[ctx.spreadsheetId,old.meetingId]);
  return {lead:old,changedSales,impact,meetingId:old.meetingId??undefined};
 });
}
export async function listDbSheetSuppliers(ctx:DbSheetContext){
 guard(ctx);const r=await getDbPool().query("select distinct trim(data->>'supplier') as supplier from db_sheet_history where spreadsheet_id=$1 and trim(coalesce(data->>'supplier',''))<>'' order by supplier",[ctx.spreadsheetId]);return r.rows.map((x:{supplier:string})=>x.supplier);
}

/** 부재 기록 추가(2026-10-23 belie) — 같은 날짜·시각은 한 번만, 최근 60줄까지. 컨택결과·실적은 바꾸지 않는다. */
export async function addDbSheetAbsence(ctx:DbSheetContext,leadId:string,entry:DbSheetAbsence,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);const add=DbSheetAbsence.parse(entry);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);
  const list=[...(old.absences??[]).filter(a=>!(a.date===add.date&&a.hour===add.hour)),add].sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour).slice(-60);
  // 부재를 적으면 다음 연락일을 그 다음날로(2026-10-25 belie) — 비었거나 이미 지난(그날까지인) 예약일 때만. 새 예약 세대.
  const reschedule=!old.next||old.next<=add.date;
  const next=reschedule?fmtISO(addDays(parseISO(add.date),1)):old.next;
  const followUp=reschedule?{generation:(old.followUp?.generation??0)+1,completedGeneration:old.followUp?.completedGeneration??null,lastContactDate:old.followUp?.lastContactDate??""}:old.followUp;
  const lead:DbSheetLead={...old,absences:list,next,...(followUp?{followUp}:{}),revision:old.revision+1};
  await persist(c,ctx,lead);return {lead:old.meetingId?await linkedProjection(c,ctx,lead):lead,changedSales:[]};
 });
}
export async function removeDbSheetAbsence(ctx:DbSheetContext,leadId:string,entry:DbSheetAbsence,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);const del=DbSheetAbsence.parse(entry);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);
  const lead:DbSheetLead={...old,absences:(old.absences??[]).filter(a=>!(a.date===del.date&&a.hour===del.hour)),revision:old.revision+1};
  await persist(c,ctx,lead);return {lead:old.meetingId?await linkedProjection(c,ctx,lead):lead,changedSales:[]};
 });
}
export type DbSheetMeetingCandidate={id:string;company:string;reservedOn:string;meetingDate:string;state:string};
/**
 * 따로 잡은 미팅 연결 후보(2026-10-23 belie): STEP 2 에서 직접 잡아 어느 DB 에도 이어지지 않은 미팅 중
 * 업체명이 같거나 비슷한 것. 취소·삭제된 미팅, 다른 미팅의 이전 기록(변경 이력)은 뺀다.
 */
export async function listDbSheetMeetingCandidates(ctx:DbSheetContext,leadId:string):Promise<DbSheetMeetingCandidate[]>{
 guard(ctx);z.string().uuid().parse(leadId);const c=getDbPool();
 const lead=await read(c,ctx,leadId);if(!lead||lead.meetingId)return [];
 const names=[lead.company,lead.contact.companyName].filter(n=>n&&n.trim());
 const linked=new Set((await c.query("select meeting_id from db_sheet_leads where spreadsheet_id=$1 and meeting_id is not null",[ctx.spreadsheetId])).rows.map((r:{meeting_id:string})=>r.meeting_id));
 const rows=await meetingRows(c,ctx);
 const superseded=new Set(rows.map(r=>String(r.payload.previousMeetingId??"")).filter(Boolean));
 return rows.flatMap(r=>{
  // db_sheet_leads.meeting_id 는 uuid 열 — 예전 브라우저가 만든 uuid 아닌 id 는 연결할 수 없어 후보에서 뺀다.
  if(r.payload._cleared||linked.has(r.row_key)||superseded.has(r.row_key)||!z.string().uuid().safeParse(r.row_key).success)return [];
  const parsed=Meeting.safeParse(r.payload);if(!parsed.success)return [];
  const m=parsed.data;if(m.상태==="취소"||!names.some(n=>isSimilarDbSheetCompany(n,m.업체명)))return [];
  return [{id:m.id,company:m.업체명,reservedOn:m.예약일,meetingDate:m.미팅날짜,state:m.상태}];
 }).slice(0,10);
}
/** 후보 미팅을 이 DB 에 연결 — 표시만 단다. 미팅 날짜·결과·STEP 2·STEP 3 실적은 바꾸지 않는다. 「연결 풀기」로 되돌린다. */
export async function linkDbSheetMeeting(ctx:DbSheetContext,leadId:string,meetingId:string,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);z.string().uuid().parse(meetingId);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);
  if(old.meetingId)throw new DbSheetOperationBlocked("이미 미팅이 연결된 업체예요.");
  const row=(await meetingRows(c,ctx,true)).find(r=>r.row_key===meetingId);
  if(!row||row.payload._cleared||!Meeting.safeParse(row.payload).success)throw new DbSheetOperationBlocked("연결할 미팅을 찾지 못했어요. 새로고침해 주세요.");
  const taken=await c.query("select 1 from db_sheet_leads where spreadsheet_id=$1 and meeting_id=$2 limit 1",[ctx.spreadsheetId,meetingId]);
  if(taken.rows.length)throw new DbSheetOperationBlocked("이 미팅은 이미 다른 DB 에 연결돼 있어요.");
  const lead:DbSheetLead={...withoutManualStage(old),meetingId,linkedExisting:true,contact:{...old.contact,registered:true},revision:old.revision+1};
  await persist(c,ctx,lead);return {lead:await linkedProjection(c,ctx,lead),changedSales:[]};
 });
}
/** 연결 풀기 — 「연결」로 붙인 미팅만 푼다(DB관리시트에서 직접 등록한 미팅은 STEP 3 에서 관리). */
export async function unlinkDbSheetMeeting(ctx:DbSheetContext,leadId:string,expectedRevision:number):Promise<DbSheetChange>{
 z.string().uuid().parse(leadId);
 return transaction(ctx,async c=>{
  const old=await expected(c,ctx,leadId,expectedRevision);
  if(!old.meetingId||!old.linkedExisting)throw new DbSheetOperationBlocked("이 DB 에서 직접 등록한 미팅은 연결을 풀 수 없어요. STEP 3 일정·계약에서 관리해 주세요.");
  const lead:DbSheetLead={...old,meetingId:null,contact:{...old.contact,registered:false},revision:old.revision+1};
  delete lead.linkedExisting;
  lead.stage=dbSheetContactStage({...lead,stage:"",hasQualifiedContact:lead.hasQualifiedContact??!!lead.first});
  await persist(c,ctx,lead);return {lead,changedSales:[]};
 });
}

/** 휴지통(2026-10-26 belie 「10초가 아니라 휴지통에서 되돌리기, 비우기도」) — 삭제 직전 DB·상담 기록·이력을 sheet_rows(tab=db_sheet_trash)에 그대로 보관한다.
 *  시트 미러 대상이 아니다(mirror_pending=false). 되돌리면 같은 id 로 다시 넣고 STEP 2 기여분을 되살린다. 비우면 보관본만 지운다. */
const TRASH_TAB="db_sheet_trash";
type TrashSnapshot={lead:DbSheetLead;contacts:Record<string,unknown>[];history:Record<string,unknown>[];deletedAt:string};
async function moveToTrash(c:PoolClient,ctx:DbSheetContext,old:DbSheetLead){
 const contacts=(await c.query("select contact_date::text as contact_date,qualified,result,note from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,old.id])).rows;
 const history=(await c.query("select revision,data,recorded_at::text as recorded_at from db_sheet_history where spreadsheet_id=$1 and lead_id=$2",[ctx.spreadsheetId,old.id])).rows;
 const raw=(await c.query("select data from db_sheet_leads where spreadsheet_id=$1 and id=$2",[ctx.spreadsheetId,old.id])).rows[0]?.data??old;
 const snapshot:TrashSnapshot={lead:{...raw,_recorded:old._recorded},contacts,history,deletedAt:new Date().toISOString()};
 await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,$4,$5,$6::jsonb,false)
  on conflict(spreadsheet_id,tab,row_key) do update set payload=excluded.payload,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,TRASH_TAB,old.id,JSON.stringify(snapshot)]);
}
export async function listDbSheetTrash(ctx:DbSheetContext):Promise<DbSheetTrashItem[]>{
 guard(ctx);const r=await getDbPool().query("select payload from sheet_rows where spreadsheet_id=$1 and tab=$2 order by payload->>'deletedAt' desc",[ctx.spreadsheetId,TRASH_TAB]);
 return r.rows.map(({payload:p}:{payload:TrashSnapshot})=>({id:p.lead.id,company:p.lead.company,owner:p.lead.owner,phone:p.lead.phone,channel:p.lead.channel,supplier:p.lead.supplier,date:p.lead.date,deletedAt:p.deletedAt}));
}
/** 되돌리기 — 같은 업체가 이미 있으면(allowDuplicate 아니면) DbSheetDuplicate. 한 건이라도 막히면 전부 되돌리지 않는다. */
export async function restoreDbSheetTrash(ctx:DbSheetContext,ids:string[],allowDuplicate=false):Promise<DbSheetChange[]>{
 z.array(z.string().uuid()).min(1).max(500).parse(ids);
 return transaction(ctx,async c=>{
  const out:DbSheetChange[]=[];
  for(const id of ids){
   const row=(await c.query("select payload from sheet_rows where spreadsheet_id=$1 and tab=$2 and row_key=$3 for update",[ctx.spreadsheetId,TRASH_TAB,id])).rows[0];
   if(!row)continue;const snap=row.payload as TrashSnapshot;
   if(await read(c,ctx,id)){await c.query("delete from sheet_rows where spreadsheet_id=$1 and tab=$2 and row_key=$3",[ctx.spreadsheetId,TRASH_TAB,id]);continue;}
   if(!allowDuplicate)await assertNotDuplicate(c,ctx,snap.lead);
   const stored={...snap.lead};
   await c.query(`insert into db_sheet_leads(spreadsheet_id,id,revision,data,meeting_id) values($1,$2,$3,$4::jsonb,$5)`,[ctx.spreadsheetId,id,stored.revision,JSON.stringify(stored),stored.meetingId??null]);
   for(const h of snap.history)await c.query("insert into db_sheet_history(spreadsheet_id,lead_id,revision,data,recorded_at) values($1,$2,$3,$4::jsonb,$5::timestamptz)",[ctx.spreadsheetId,id,h.revision,JSON.stringify(h.data),h.recorded_at]);
   for(const x of snap.contacts)await c.query("insert into db_sheet_contacts(spreadsheet_id,lead_id,contact_date,qualified,result,note) values($1,$2,$3::date,$4,$5,$6) on conflict do nothing",[ctx.spreadsheetId,id,x.contact_date,x.qualified,x.result,x.note]);
   if(stored.meetingId)await c.query("update sheet_rows set payload=payload-'_dbSheetLeadDeleted',updated_at=now() where spreadsheet_id=$1 and tab='meetings' and row_key=$2",[ctx.spreadsheetId,stored.meetingId]);
   const changedSales=await applyDeltas(c,ctx,await contributions(c,ctx,snap.lead,1));
   await c.query("delete from sheet_rows where spreadsheet_id=$1 and tab=$2 and row_key=$3",[ctx.spreadsheetId,TRASH_TAB,id]);
   const lead=await read(c,ctx,id);if(!lead)throw new DbSheetConflict();
   out.push({lead:withInflowStatus(lead),changedSales,impact:contributionImpact(null,lead)});
  }
  return out;
 });
}
/** 영구 삭제 — ids 가 없으면 휴지통 전체. 보관본만 지운다(STEP 2 기여분은 휴지통으로 옮길 때 이미 뺐다). */
export async function emptyDbSheetTrash(ctx:DbSheetContext,ids?:string[]):Promise<number>{
 guard(ctx);if(ids)z.array(z.string().uuid()).max(500).parse(ids);
 const r=ids?await getDbPool().query("delete from sheet_rows where spreadsheet_id=$1 and tab=$2 and row_key=any($3::text[])",[ctx.spreadsheetId,TRASH_TAB,ids])
  :await getDbPool().query("delete from sheet_rows where spreadsheet_id=$1 and tab=$2",[ctx.spreadsheetId,TRASH_TAB]);
 return r.rowCount??0;
}
