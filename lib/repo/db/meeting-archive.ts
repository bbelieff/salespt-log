/** Layer: repo — reversible simple reservations; no partial cascade restoration. */
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import { meetingFromDbPayload, contractFromDbPayload } from "./read-daily";
import { lockedMeetingCounts } from "./sales-meeting-counts";
import type { Meeting } from "@/types";

type Context = { spreadsheetId:string; cohort:string; email:string };
type Stored = { tab:string; row_key:string; payload:Record<string,unknown>; updated_at?:Date|string };
/** deletedAt = 행의 마지막 변경 시각(지운 뒤엔 못 고치므로 = 지운 때) — 앱 휴지통 정렬용. */
export type ArchivedMeeting = { meeting:Meeting; restorable:boolean; reason:string; deletedAt?:string };
function reasonFor(meeting:Meeting, rows:Stored[]):string {
  if (meeting.상태 !== "예약" || meeting.계약여부 || meeting.previousMeetingId || meeting.구분 === "이월") return "계약·일정 변경 이력이 있는 미팅은 여기서 복원할 수 없어요.";
  if (rows.some(r => r.tab === "meetings" && meetingFromDbPayload(r.payload)?.previousMeetingId === meeting.id)) return "연결된 미팅 이력이 있어 개별 복원할 수 없어요.";
  if (rows.some(r => {if(r.tab!=="contracts")return false;const c=contractFromDbPayload(r.payload,Number(r.row_key.replace(/^r/,""))||4);return c && (c.linkedMeetingId===meeting.id || (c.업체명.trim()===meeting.업체명.trim() && c.계약일===meeting.미팅날짜));})) return "연결된 계약 이력이 있어 개별 복원할 수 없어요.";
  return "";
}
export async function listArchivedMeetings(ctx:Context):Promise<ArchivedMeeting[]> {
  if (!dbEnabled()) return [];
  await ensureSchema();
  const result=await getDbPool().query("select tab,row_key,payload,updated_at from sheet_rows where spreadsheet_id=$1 and tab in ('meetings','contracts')",[ctx.spreadsheetId]);
  const rows=result.rows as Stored[];
  return rows.filter(r=>r.tab==='meetings' && r.payload._cleared===true && r.payload._dbSheetLeadDeleted!==true).flatMap(r=>{
    const meeting=meetingFromDbPayload(r.payload);if(!meeting)return [];
    const reason=reasonFor(meeting,rows);return [{meeting,restorable:!reason,reason,...(r.updated_at?{deletedAt:new Date(r.updated_at).toISOString()}:{})}];
  }).sort((a,b)=>b.meeting.미팅날짜.localeCompare(a.meeting.미팅날짜));
}
/** Table lock also serializes existing writers which do not take the DB-sheet advisory lock.
 * Never make network calls while holding this short transaction. */
export async function setSimpleMeetingArchived(ctx:Context,id:string,archived:boolean):Promise<Meeting|null> {
  if (!dbEnabled()) throw new Error("MEETING_ARCHIVE_UNAVAILABLE");
  await ensureSchema(); const client=await getDbPool().connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`db-sheet:${ctx.spreadsheetId}`]);
    await client.query("lock table sheet_rows in share row exclusive mode");
    const result=await client.query("select tab,row_key,payload from sheet_rows where spreadsheet_id=$1 and tab in ('meetings','contracts')",[ctx.spreadsheetId]);
    const rows=result.rows as Stored[], row=rows.find(r=>r.tab==='meetings' && r.row_key===id);
    const meeting=row && meetingFromDbPayload(row.payload);
    if (!row || !meeting) {if(archived){await client.query("rollback");return null;}throw new Error("MEETING_ARCHIVE_NOT_FOUND");}
    if(row.payload._dbSheetLeadDeleted===true)throw new Error("MEETING_ARCHIVE_PURGED");
    const reason=reasonFor(meeting,rows);
    if(reason){if(archived){await client.query('rollback');return null;}throw new Error("MEETING_ARCHIVE_COMPLEX");}
    if(archived)await lockedMeetingCounts(client,ctx.spreadsheetId,true);
    await client.query("update sheet_rows set payload=payload || $3::jsonb,mirror_pending=true,updated_at=now() where spreadsheet_id=$1 and tab='meetings' and row_key=$2",[ctx.spreadsheetId,id,JSON.stringify({_cleared:archived})]);
    // Current activity preference and immutable per-meeting contribution evidence
    // settle together with the restored row through the shared canonical counter.
    const counts=await lockedMeetingCounts(client,ctx.spreadsheetId,true);
    const key=`${meeting.예약일}:${meeting.channel}`;
    await client.query(`insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload,mirror_pending) values($1,$2,$3,'sales',$4,$5::jsonb,true)
      on conflict(spreadsheet_id,tab,row_key) do update set payload=sheet_rows.payload || excluded.payload,mirror_pending=true,updated_at=now()`,[ctx.cohort,ctx.email,ctx.spreadsheetId,key,JSON.stringify({date:meeting.예약일,channel:meeting.channel,meetingReservation:counts.get(key)??0})]);
    await client.query('commit');return meeting;
  }catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}
}
