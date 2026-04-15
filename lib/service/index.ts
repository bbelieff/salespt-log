/**
 * Layer: service — 유스케이스. Repo 조합 + 도메인 규칙.
 * UI/Runtime(API Route) 에서 호출하는 유일한 진입점이 되어야 한다.
 */
import { findUserByEmail } from "@/repo/users";
import { appendEntry, fetchEntries } from "@/repo/daily";
import { DailyEntry } from "@/types";
import { summarize, type Stats } from "./gamification";

export async function resolveUser(email: string) {
  return findUserByEmail(email);
}

export async function getMyDashboard(email: string): Promise<
  | { ok: true; entries: DailyEntry[]; stats: Stats }
  | { ok: false; reason: "not_registered" }
> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "not_registered" };
  const entries = await fetchEntries(user.spreadsheetId);
  return { ok: true, entries, stats: summarize(entries) };
}

export async function logToday(
  email: string,
  input: Omit<DailyEntry, "date"> & { date?: string },
): Promise<
  | { ok: true; stats: Stats }
  | { ok: false; reason: "not_registered" }
> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "not_registered" };
  const entry = DailyEntry.parse({
    date: input.date ?? new Date().toISOString().slice(0, 10),
    production: input.production,
    contact: input.contact,
    meeting: input.meeting,
    contract: input.contract,
    note: input.note,
  });
  await appendEntry(user.spreadsheetId, entry);
  const entries = await fetchEntries(user.spreadsheetId);
  return { ok: true, stats: summarize(entries) };
}
