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

// 같은 셀(한 일정 행의 gcal_event_ids)에 대한 read-merge-write 를 프로세스 내 직렬화 —
// 멀티계정 훅이 근접 동시 실행돼도 lost update(상대 키 유실) 방지. 단일 VPS/pm2 단일
// 인스턴스 기준 유효(락 안에서 매번 최신 셀 재조회 후 merge).
const cellLocks = new Map<string, Promise<unknown>>();
function withCellLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = cellLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  cellLocks.set(key, next);
  // 정리 브랜치는 자체 catch 필수 — 없으면 fn 거부(Sheets 429 등) 시 unhandledRejection 누출
  // (실제 에러는 반환된 next 로 호출부 guard 가 처리·재시도).
  void next
    .finally(() => {
      if (cellLocks.get(key) === next) cellLocks.delete(key);
    })
    .catch(() => {});
  return next;
}

async function writeCell(
  spreadsheetId: string,
  tab: string,
  col: string,
  row: number,
  value: string,
): Promise<void> {
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(tab)}!${col}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

/**
 * 여러 id 의 토글 상태(담김=true, 제외 마커 "-"면 false) 배치 조회 — A열+맵열 1회 batchGet.
 * 행 못 찾은 id 는 기본 ON(true). gcal-2b 캘린더 토글 초기 상태용.
 */
export async function readGcalStates(
  spreadsheetId: string,
  kind: GcalEventKind,
  ids: string[],
  email: string,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  if (!ids.length) return out;
  const { tab, col } = SPEC[kind];
  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${tabRef(tab)}!A2:A`, `${tabRef(tab)}!${col}2:${col}`],
  });
  const idCol = res.data.valueRanges?.[0]?.values ?? [];
  const mapCol = res.data.valueRanges?.[1]?.values ?? [];
  const wanted = new Set(ids);
  for (let i = 0; i < idCol.length; i++) {
    const rid = String(idCol[i]?.[0] ?? "").trim();
    if (!rid || !wanted.has(rid) || rid in out) continue;
    out[rid] = parseMap(String(mapCol[i]?.[0] ?? "").trim())[email] !== "-";
  }
  for (const id of ids) if (!(id in out)) out[id] = true; // 미발견=기본 ON
  return out;
}

/**
 * 사용자 키의 eventId 설정(eventId=null → 키 제거). 락 안에서 read-merge-write —
 * 타 사용자 키 보존 + 동시성 lost update 방지. 행 없으면(삭제됨) no-op. 빈 맵=빈 셀.
 * apostrophe prefix 로 plain text 강제(읽을 때 `'` 없이 복원).
 */
export async function setGcalEventId(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
  email: string,
  eventId: string | null,
): Promise<void> {
  const { tab, col, gridCols } = SPEC[kind];
  await withCellLock(`${spreadsheetId}:${kind}:${id}`, async () => {
    const row = await findRow(spreadsheetId, tab, id);
    if (row === null) return;
    await ensureGridColumns(spreadsheetId, tab, gridCols);
    const map = parseMap(await readCell(spreadsheetId, tab, col, row));
    if (eventId === null) delete map[email];
    else map[email] = eventId;
    const json = Object.keys(map).length ? `'${JSON.stringify(map)}` : "";
    await writeCell(spreadsheetId, tab, col, row, json);
  });
}

/**
 * 셀 전체 비움(맵 폐기) — 일정 행 삭제 시 호출. 행 재사용이 stale 맵을 상속해
 * 타 사용자 살아있는 이벤트를 덮어쓰는 사고 + 고아 맵 방지. 행 없으면 no-op.
 */
export async function clearGcalCell(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
): Promise<void> {
  const { tab, col } = SPEC[kind];
  await withCellLock(`${spreadsheetId}:${kind}:${id}`, async () => {
    const row = await findRow(spreadsheetId, tab, id);
    if (row === null) return;
    await writeCell(spreadsheetId, tab, col, row, "");
  });
}

/**
 * 실제 이벤트 키만 제거하고 제외 마커("-")는 보존 — 되돌릴 수 있는 전이(미팅 취소·투두 숨김)에서
 * 타 사용자의 개별 토글 제외를 지키기 위함. 행 삭제(비가역)는 clearGcalCell(전체 비움) 사용.
 */
export async function keepOnlyMarkers(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
): Promise<void> {
  const { tab, col } = SPEC[kind];
  await withCellLock(`${spreadsheetId}:${kind}:${id}`, async () => {
    const row = await findRow(spreadsheetId, tab, id);
    if (row === null) return;
    const map = parseMap(await readCell(spreadsheetId, tab, col, row));
    const kept: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) if (v === "-") kept[k] = v;
    const json = Object.keys(kept).length ? `'${JSON.stringify(kept)}` : "";
    await writeCell(spreadsheetId, tab, col, row, json);
  });
}
