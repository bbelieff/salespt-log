/** Layer: service — account scoped archive and existing sheet/calendar convergence. */
import { resolveCtx } from "./contact";
import { usesDbStorage } from "./daily-source";

import { listArchivedMeetings, setSimpleMeetingArchived } from "@/repo/db/meeting-archive";
import { queueMeetingSheetSync, type MeetingCtx } from "./meetings-write";
import { queueSalesRowSync } from "./sales-write";
export async function archiveSimpleMeeting(ctx:MeetingCtx,id:string) {
  if(!usesDbStorage(ctx.cohort))return null;
  const meeting=await setSimpleMeetingArchived(ctx,id,true);
  if(meeting){queueMeetingSheetSync(ctx,id);queueSalesRowSync(ctx,meeting.예약일,meeting.channel);}
  return meeting;
}
export async function deletedMeetings(email:string,sheetOverride?:string) {
  const ctx=await resolveCtx(email);
  if(sheetOverride&&sheetOverride!==ctx.spreadsheetId)throw new Error("MEETING_ARCHIVE_UNAVAILABLE");
  if(!usesDbStorage(ctx.cohort))return [];
  return listArchivedMeetings(ctx);
}
export async function restoreDeletedMeeting(email:string,id:string,sheetOverride?:string) {
  const ctx=await resolveCtx(email);
  if(sheetOverride&&sheetOverride!==ctx.spreadsheetId)throw new Error("MEETING_ARCHIVE_UNAVAILABLE");
  if(!usesDbStorage(ctx.cohort))throw new Error("MEETING_ARCHIVE_UNAVAILABLE");
  const meeting=await setSimpleMeetingArchived(ctx,id,false);
  if(!meeting)throw new Error("MEETING_ARCHIVE_COMPLEX");
  queueMeetingSheetSync(ctx,id);queueSalesRowSync(ctx,meeting.예약일,meeting.channel);
  return meeting;
}
