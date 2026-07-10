/**
 * Layer: repo — 앱 일정 행 ↔ 구글 eventId 매핑 저장 (gcal-2, google-calendar-sync §2).
 *
 * 저장 위치: 04 미팅 탭 **AT열** · 05 실무투두 탭 **O열**. 값 = 사용자별 JSON 맵
 * `{"salesptEmail": "eventId"}` — 한 시트 멀티계정(부부·직원)이 각자 연결해도 충돌 0.
 *
 * ★설계(위험 최소화): meetings.ts/todos.ts 의 행 쓰기(writeMeetingRowSplit 은 A:M/P/R/T:AN/
 * AQ:AS, writeTodoRow 는 A:N)는 이 컬럼을 **범위 밖**으로 두어 안 건드린다 → 미팅/투두 행
 * 저장·클리어와 **독립 보존**. 이 모듈만 해당 셀을 read-merge-write(타 사용자 키 보존).
 */
import { SHEET_RANGES } from "@/config";
import { ensureGridColumns, sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

export type GcalEventKind = "meeting" | "todo";

// meetings: AT = 46번째 컬럼(index 45, 기존 마지막 AS 뒤). todos: O = 15번째(index 14, N 뒤).
const SPEC: Record<GcalEventKind, { tab: string; col: string; gridCols: number }> = {
  meeting: { tab: SHEET_RANGES.meetings.tab, col: "AT", gridCols: 46 },
  todo: { tab: SHEET_RANGES.todos.tab, col: "O", gridCols: 15 },
};

/** id → 행 번호(1-based, 없으면 null). A열 직접 탐색(meetings/todos 와 동일 규약). */
async function findRow(
  spreadsheetId: string,
  tab: string,
  id: string,
): Promise<number | null> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(tab)}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? ""));
  const idx = ids.indexOf(id);
  return idx < 0 ? null : idx + 2;
}

function parseMap(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    /* 손상 JSON → 빈 맵 */
  }
  return {};
}

async function readCell(
  spreadsheetId: string,
  tab: string,
  col: string,
  row: number,
): Promise<string> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(tab)}!${col}${row}`,
  });
  return String(res.data.values?.[0]?.[0] ?? "").trim();
}

/** 한 일정 행의 사용자별 eventId 맵 조회(행 없으면 빈 맵). */
export async function readGcalMap(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
): Promise<Record<string, string>> {
  const { tab, col } = SPEC[kind];
  const row = await findRow(spreadsheetId, tab, id);
  if (row === null) return {};
  return parseMap(await readCell(spreadsheetId, tab, col, row));
}

/**
 * 사용자 키의 eventId 설정(eventId=null → 키 제거). read-merge-write 로 타 사용자 키 보존.
 * 행이 없으면(삭제됨) no-op. 맵이 비면 셀을 빈 문자열로.
 */
export async function setGcalEventId(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  email: string,
  eventId: string | null,
): Promise<void> {
  const { tab, col, gridCols } = SPEC[kind];
  const row = await findRow(spreadsheetId, tab, id);
  if (row === null) return;
  await ensureGridColumns(spreadsheetId, tab, gridCols);
  const map = parseMap(await readCell(spreadsheetId, tab, col, row));
  if (eventId === null) delete map[email];
  else map[email] = eventId;
  // apostrophe prefix 로 plain text 강제(읽을 때 `'` 없이 복원). 빈 맵=빈 셀.
  const json = Object.keys(map).length ? `'${JSON.stringify(map)}` : "";
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(tab)}!${col}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[json]] },
  });
}
