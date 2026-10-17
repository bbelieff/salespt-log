/** Server-owned contribution evidence. Input schemas deliberately omit _recorded. */
import type { PoolClient } from "pg";
import type { DbSheetContext, DbSheetLead, DbSheetImpact } from "@/types/db-sheet";
type Client=Pick<PoolClient,"query">;
export class DbSheetOperationBlocked extends Error {}
/** Creation before selectable recording always contributed +1 (32219da9^). A future OFF policy is not proof of subtraction. */
export function recordedInflow(lead:DbSheetLead):boolean{
 const recorded=lead._recorded,policy=lead.recording;
 if(policy!==undefined&&(!policy||typeof policy.inflow!=='boolean'))throw new DbSheetOperationBlocked('유입 반영 설정이 올바르지 않아 처리할 수 없습니다.');
 if(recorded!==undefined){
  if(!recorded||typeof recorded.inflow!=='boolean'||(policy?.inflow===true&&!recorded.inflow))throw new DbSheetOperationBlocked('유입 기여 기록과 설정이 맞지 않아 처리할 수 없습니다.');
  return recorded.inflow;
 }
 if(policy?.inflow===false)throw new DbSheetOperationBlocked('유입 기여 기록이 누락되어 처리할 수 없습니다. 기록 복구가 필요합니다.');
 return true;
}
export async function hydrateRecording(c:Client,ctx:DbSheetContext,lead:DbSheetLead):Promise<DbSheetLead>{
 const inflow=recordedInflow(lead);
 lead={...lead,recording:lead.recording??{inflow,activities:true}};
 if(lead._recorded){
  if(lead._recorded.meetingIds!==undefined)return lead;
  const rows=lead._recorded.meeting?await lineage(c,ctx,lead.meetingId):[];
  return {...lead,_recorded:{...lead._recorded,meetingIds:rows.map(r=>r.row_key)}};
 }
 const contacts=await c.query("select contact_date::text as date from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,lead.id]);
 const history=await c.query("select 1 from db_sheet_history where spreadsheet_id=$1 and lead_id=$2 and revision=1",[ctx.spreadsheetId,lead.id]);
 // History absence remains internal deletion evidence only, not a third inflow state. Reads never backfill.
 return {...lead,recording:lead.recording??{inflow:true,activities:true},_recorded:{inflow,contacts:contacts.rows.map((r:{date:string})=>r.date),meeting:!!lead.meetingId,meetingIds:(await lineage(c,ctx,lead.meetingId)).map(r=>r.row_key),legacyUnknown:!history.rows.length}};
}
export function withInflowStatus(lead:DbSheetLead):DbSheetLead{
 return {...lead,inflowStatus:recordedInflow(lead)?{state:"recorded",date:lead.date,channel:lead.channel,count:1}:{state:"excluded",count:0}};
}
/** Validate the whole tenant/date/channel ledger before touching a single contribution; manual total = inflow - tagged. */
export async function inflowBlockReason(c:Client,ctx:DbSheetContext,lead:DbSheetLead,nextInflow:boolean):Promise<string|undefined>{
 const row=await c.query("select payload from sheet_rows where spreadsheet_id=$1 and tab='sales' and row_key=$2 for update",[ctx.spreadsheetId,lead.date+':'+lead.channel]);
 const peers=await c.query("select data from db_sheet_leads where spreadsheet_id=$1 and data->>'date'=$2 and data->>'channel'=$3 for update",[ctx.spreadsheetId,lead.date,lead.channel]);
 let owned:number;try{owned=peers.rows.reduce((n:number,r:{data:DbSheetLead})=>n+Number(recordedInflow(r.data)),0);}catch{return '같은 날짜의 유입 기여 기록이 맞지 않아 변경할 수 없습니다.';}
 const payload=row.rows[0]?.payload;
 if(payload!==undefined&&(!payload||typeof payload!=='object'||Array.isArray(payload)))return '해당 날짜의 유입 기록 형식이 맞지 않아 변경할 수 없습니다.';
 const total=payload?.inflow===undefined?0:payload.inflow,tagged=payload?._dbSheetInflow===undefined?0:payload._dbSheetInflow;
 if(typeof total!=='number'||!Number.isSafeInteger(total)||total<0||typeof tagged!=='number'||!Number.isSafeInteger(tagged)||tagged<0||tagged!==owned||tagged>total)return '해당 날짜의 유입 기록이 맞지 않아 변경할 수 없습니다.';
 const delta=Number(nextInflow)-Number(recordedInflow(lead)),nextTotal=total+delta,nextTagged=tagged+delta;
 if(!Number.isSafeInteger(nextTotal)||nextTotal<0||!Number.isSafeInteger(nextTagged)||nextTagged<0)return '유입 건수가 안전한 저장 범위를 벗어나 변경할 수 없습니다.';
 // Missing zero is a supported empty baseline; missing positive production is a conflict, not permission to manufacture it.
 if(lead.channel==='직접생산'&&(payload?.production===undefined?0:payload.production)!==total)return '해당 날짜의 직접생산 기록이 맞지 않아 변경할 수 없습니다.';
}
export async function settleRecording(c:Client,ctx:DbSheetContext,lead:DbSheetLead){
 const policy=lead.recording??{inflow:true,activities:true};
 const recorded=lead._recorded??{inflow:false,contacts:[],meeting:false};
 const contacts=policy.activities?await c.query("select contact_date::text as date from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,lead.id]):{rows:[]};
 const active=policy.activities?(await lineage(c,ctx,lead.meetingId)).filter(r=>!r.payload._cleared):[];
 const meetingIds=[...new Set([...(recorded.meetingIds??(recorded.meeting&&lead.meetingId?[lead.meetingId]:[])),...active.map(r=>r.row_key)])];
 lead.recording=policy;lead._recorded={...recorded,inflow:recorded.inflow||policy.inflow,contacts:[...new Set([...recorded.contacts,...contacts.rows.map((r:{date:string})=>r.date)])].sort(),meeting:meetingIds.length>0,meetingIds};
 lead.inflowStatus=withInflowStatus(lead).inflowStatus;
}
export function contributionImpact(before:DbSheetLead|null,after:DbSheetLead|null):DbSheetImpact{
 const rows=new Map<string,DbSheetImpact['rows'][number]>();
 for(const [lead,sign] of [[before,-1],[after,1]] as const){
  if(!lead?._recorded)continue;
  const add=(date:string,inflow:number,contacts:number)=>{const key=date+':'+lead.channel;const r=rows.get(key)??{date,channel:lead.channel,inflow:0,contacts:0,meetings:0};r.inflow+=inflow*sign;r.contacts+=contacts*sign;rows.set(key,r);};
  if(lead._recorded.inflow)add(lead.date,1,0);
  for(const date of lead._recorded.contacts)add(date,0,1);
 }
 const changed=[...rows.values()].filter(r=>r.inflow||r.contacts||r.meetings);
 return {inflow:changed.reduce((n,r)=>n+r.inflow,0),contacts:changed.reduce((n,r)=>n+r.contacts,0),meetings:0,rows:changed};
}
async function lineage(c:Client,ctx:DbSheetContext,id:string|null):Promise<{row_key:string;payload:Record<string,unknown>}[]>{
 if(!id)return [];
 const r=await c.query(`with recursive lineage as (select row_key,payload from sheet_rows where spreadsheet_id=$1 and tab='meetings' and row_key=$2 union select s.row_key,s.payload from sheet_rows s join lineage l on s.payload->>'previousMeetingId'=l.row_key where s.spreadsheet_id=$1 and s.tab='meetings') select row_key,payload from lineage`,[ctx.spreadsheetId,id]);return r.rows;
}
export async function meetingImpact(c:Client,ctx:DbSheetContext,before:DbSheetLead,after:DbSheetLead,impact:DbSheetImpact){
 const existing=new Set(before._recorded?.meetingIds??[]),added=new Set((after._recorded?.meetingIds??[]).filter(id=>!existing.has(id)));
 if(!added.size)return impact;
 for(const {row_key,payload} of await lineage(c,ctx,after.meetingId)){
  if(payload._cleared||!added.has(row_key))continue;
  const date=String(payload.예약일),channel=payload.channel as DbSheetLead['channel'];let row=impact.rows.find(x=>x.date===date&&x.channel===channel);if(!row){row={date,channel,inflow:0,contacts:0,meetings:0};impact.rows.push(row);}row.meetings++;impact.meetings++;
 }return impact;
}
