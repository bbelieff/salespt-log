/** Shared selected reservation count for STEP 2 reads and general meeting writes. */
import {getDbPool} from './client';
import {lockedMeetingCounts} from './sales-meeting-counts';
import type {DbSheetContext} from '@/types/db-sheet';
export async function readSelectedMeetingCounts(spreadsheetId:string){return lockedMeetingCounts(getDbPool(),spreadsheetId);}
export async function persistSelectedMeetingCount(ctx:DbSheetContext,date:string,channel:string){
 const c=await getDbPool().connect();
 try{await c.query('begin');await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['db-sheet:'+ctx.spreadsheetId]);
 const key=date+':'+channel;const count=(await lockedMeetingCounts(c,ctx.spreadsheetId,true)).get(key)??0;
 await c.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true) on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload||excluded.payload,updated_at=now(),mirror_pending=true`,[ctx.cohort,ctx.email,ctx.spreadsheetId,key,JSON.stringify({date,channel,meetingReservation:count})]);
 await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
