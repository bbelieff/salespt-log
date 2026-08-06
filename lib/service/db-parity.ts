/**
 * Layer: service — DB 파일럿 대조(기수·탭별 시트 행수 vs DB 행수, db-migration-pilot §3).
 * admin /admin/db-parity 페이지 전용 — 온디맨드(무거움: 기수 인원×탭 read).
 * 시트 유효 행 판정은 backfill 스크립트(scripts/ops/backfill-sheet-rows.mjs)와 동일 규칙.
 * 2026-08-06 수정: contracts·sales 는 과거 "키 열 비어있지 않음"만 보고 헤더·예시행/주차구분행을
 * 유령 데이터로 오세었음(A2 대조 실측 -140/-1568) — backfill 의 firstDataRow·O1 stride 판정으로 교체
 * (자매 수정: scripts/ops/a2-db-parity.mjs PR #724).
 */
import { SHEET_RANGES } from "@/config";
import { readCourseStart } from "@/repo/sales";
import { readRange } from "@/repo/sheets-client";
import { listAllUsers } from "@/repo/users";
import { countRowsByTab, dbEnabled } from "@/repo/db/client";

/** 신형 tab firstDataRow = SSOT(lib/config), 구형 tab 은 backfill 과 동일 하드코딩(설정값 없음, legacy). */
const CONTRACT_TAB_ALIASES = [
  [SHEET_RANGES.contractPayment.tab, SHEET_RANGES.contractPayment.firstDataRow],
  ["02 계약관리", 5],
] as const;

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

  // contracts — 신형/구형 탭 첫 데이터행부터만 카운트(backfill-sheet-rows.mjs 와 동일).
  // 그 이전 행은 헤더·예시행(2026-07-12 유령계약 사고로 firstDataRow 미만 배제 확정 — r3 "수납총액"
  // 안내행, r5 "00유통" 템플릿 예시행을 유령 계약으로 적재했던 사고).
  for (const [tab, firstDataRow] of CONTRACT_TAB_ALIASES) {
    const rows = await safeRows(sid, `'${tab}'!C${firstDataRow}:C`);
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

  // sales — O1(수강시작일) 파싱 성공한 시트만, 10주×7일×4채널 stride 로 유효한 (주차,요일,채널)
  // 위치만 카운트(backfill-sheet-rows.mjs 와 동일). 각 주차 34행 블록 중 실사용 28행(7일×4채널) 외
  // 나머지 6행(주차구분/헤더)에 텍스트가 있으면 유령 영업행으로 오세던 버그 수정.
  const hasCourseStart = await readCourseStart(sid).then(
    () => true,
    () => false,
  );
  if (hasCourseStart) {
    const block = await safeRows(sid, "'01 영업관리'!E10:H349");
    for (let w = 1; w <= 10; w++) {
      for (let d = 0; d < 7; d++) {
        for (let ch = 0; ch < 4; ch++) {
          const sheetRow = 10 + (w - 1) * 34 + d * 4 + ch;
          const r = block[sheetRow - 10] ?? [];
          const hasValue = [r[0], r[1], r[2], r[3]].some((v) => (v ?? "").trim() !== "");
          if (hasValue) c.sales++;
        }
      }
    }
  }

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
