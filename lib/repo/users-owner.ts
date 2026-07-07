/** Layer: repo — spreadsheetId → 소유자 역조회 (users.ts 에서 분리 — 500줄 캡, db-mirror 용). */
import { cachedRegistryRows, parseRow } from "./users";

/** spreadsheetId → 소유자(email·cohort) 역조회 — db-mirror 용 (60s 캐시 경유, 저비용).
 * 다중 행이면 active 우선. 못 찾으면 null(미러는 "?" 로 진행). */
export async function findOwnerBySpreadsheetId(
  spreadsheetId: string,
): Promise<{ email: string; cohort: string } | null> {
  if (!spreadsheetId) return null;
  const rows = await cachedRegistryRows();
  let fallback: { email: string; cohort: string } | null = null;
  for (const r of rows) {
    if (String(r[3] ?? "").trim() !== spreadsheetId) continue;
    const u = parseRow(r);
    if (!u) continue;
    if (u.status === "active") return { email: u.email, cohort: u.cohort };
    fallback = fallback ?? { email: u.email, cohort: u.cohort };
  }
  return fallback;
}
