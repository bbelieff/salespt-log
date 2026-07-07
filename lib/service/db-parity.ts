/**
 * Layer: service — DB 파일럿 대조(기수·탭별 시트 행수 vs DB 행수, db-migration-pilot §3).
 * admin /admin/db-parity 페이지 전용 — 온디맨드(무거움: 기수 인원×탭 read).
 * 시트 유효 행 판정은 backfill 스크립트와 동일 규칙(키 열 비어있지 않음).
 */
import { readRange } from "@/repo/sheets-client";
import { listAllUsers } from "@/repo/users";
import { countRowsByTab, dbEnabled } from "@/repo/db/client";

const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"] as const;
export type ParityTab = (typeof TABS)[number];

export interface ParityRow {
  tab: ParityTab;
  sheetCount: number;
  dbCount: number | null;
}

async function safeRows(sid: string, range: string): Promise<string[][]> {
  return readRange(sid, range).catch(() => []);
}

/** 한 시트의 탭별 유효 행수 — backfill 과 동일 판정. */
async function countUserSheet(sid: string): Promise<Record<ParityTab, number>> {
  const c: Record<ParityTab, number> = {
    meetings: 0, contracts: 0, todos: 0, sales: 0, db: 0, company_archive: 0,
  };
  for (const r of await safeRows(sid, "'04 업체관리(앱자동작성용)'!A2:A"))
    if (r[0]?.trim()) c.meetings++;
  for (const r of await safeRows(sid, "'05 실무투두'!A2:A")) if (r[0]?.trim()) c.todos++;
  for (const tab of ["02 계약수납관리", "02 계약관리"]) {
    const rows = await safeRows(sid, `'${tab}'!C3:C`);
    if (rows.length === 0) continue;
    for (const r of rows) {
      const v = r[0]?.trim() ?? "";
      if (v && !/계약일/.test(v)) c.contracts++;
    }
    break;
  }
  for (const col of ["B", "I", "P", "X"])
    for (const r of await safeRows(sid, `'03 DB관리'!${col}4:${col}100`))
      if (r[0]?.trim()) c.db++;
  const sales = await safeRows(sid, "'01 영업관리'!E10:H349");
  for (const r of sales) if ((r[0] ?? r[1] ?? r[2] ?? r[3] ?? "").toString().trim()) c.sales++;
  for (const r of await safeRows(sid, "'06 업체정보'!C2:C")) if (r[0]?.trim()) c.company_archive++;
  return c;
}

export async function getDbParity(
  cohort: string,
): Promise<{ enabled: boolean; users: number; rows: ParityRow[] }> {
  const label = cohort.replace(/기\s*$/, "").trim();
  const all = await listAllUsers();
  const seen = new Set<string>();
  const targets = all.filter(
    (u) =>
      u.spreadsheetId.trim() &&
      u.role === "trainee" &&
      u.cohort.replace(/기\s*$/, "").trim() === label &&
      !seen.has(u.spreadsheetId) &&
      (seen.add(u.spreadsheetId), true),
  );
  const sheetTotals: Record<ParityTab, number> = {
    meetings: 0, contracts: 0, todos: 0, sales: 0, db: 0, company_archive: 0,
  };
  for (const u of targets) {
    const c = await countUserSheet(u.spreadsheetId);
    for (const t of TABS) sheetTotals[t] += c[t];
  }
  const db = dbEnabled() ? await countRowsByTab(label).catch(() => null) : null;
  return {
    enabled: dbEnabled(),
    users: targets.length,
    rows: TABS.map((t) => ({ tab: t, sheetCount: sheetTotals[t], dbCount: db ? (db[t] ?? 0) : null })),
  };
}
