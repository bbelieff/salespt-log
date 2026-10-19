import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { readAllMeetings } from "@/repo/meetings";
import { readMeetingsFromDb } from "@/repo/db/read-daily";

import { isValidISODate } from "@/util/week";
import { usesDbStorage } from "./daily-source";
import type { Meeting } from "@/types";

/** Pending results have no age cutoff. Read-only, authenticated tenant only. */
export async function loadFollowUpMeetings(email: string, today: string, sheetOverride?: string): Promise<Meeting[]> {
  const user = await findUserByEmail(email, { fresh: true });
  if (!user?.spreadsheetId || (sheetOverride && sheetOverride !== user.spreadsheetId)) throw new Error("[no-sheet] Invalid student sheet");
  let meetings: Meeting[] | undefined;
  if (usesDbStorage(user)) {
    try { meetings = await readMeetingsFromDb(user.spreadsheetId); }
    catch (error) { Sentry.captureException(error, { tags: { where: "loadFollowUpMeetings-db-read" } }); }
  }
  meetings ??= await readAllMeetings(user.spreadsheetId);
  return meetings.filter(m => m.상태 === "예약" && isValidISODate(m.미팅날짜) && m.미팅날짜 <= today);
}
