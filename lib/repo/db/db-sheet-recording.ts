/** Server-owned contribution evidence. Input schemas deliberately omit _recorded. */
import type { PoolClient } from "pg";
import type { DbSheetContext, DbSheetLead, DbSheetImpact } from "@/types/db-sheet";
type Client=Pick<PoolClient,"query">;
export async function hydrateRecording(c:Client,ctx:DbSheetContext,lead:DbSheetLead):Promise<DbSheetLead>{
 if(lead._recorded){
  if(lead._recorded.meetingIds!==undefined)return lead;
  const rows=lead._recorded.meeting?await lineage(c,ctx,lead.meetingId):[];
  return {...lead,_recorded:{...lead._recorded,meetingIds:rows.map(r=>r.row_key)}};
 }
 const contacts=await c.query("select contact_date::text as date from db_sheet_contacts where spreadsheet_id=$1 and lead_id=$2 and qualified",[ctx.spreadsheetId,lead.id]);
 const history=await c.query("select 1 from db_sheet_history where spreadsheet_id=$1 and lead_id=$2 and revision=1",[ctx.spreadsheetId,lead.id]);
 // Legacy ledger always contributed on creation. Missing evidence is shown as unknown, never backfilled.
 return {...lead,recording:lead.recording??{inflow:true,activities:true},_recorded:{inflow:true,contacts:contacts.rows.map((r:{date:string})=>r.date),meeting:!!lead.meetingId,meetingIds:(await lineage(c,ctx,lead.meetingId)).map(r=>r.row_key),legacyUnknown:!history.rows.length}};
}
export function withInflowStatus(lead:DbSheetLead):DbSheetLead{
 const recorded=lead._recorded;
 return {...lead,inflowStatus:recorded?.legacyUnknown||!recorded?{state:"unknown",count:0}:recorded.inflow?{state:"recorded",date:lead.date,channel:lead.channel,count:1}:{state:"excluded",count:0}};
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
