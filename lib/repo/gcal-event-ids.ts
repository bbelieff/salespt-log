/**
 * Layer: repo — 앱 일정 행 ↔ 구글 eventId 매핑 저장 (gcal-2 · BBE-62 로 DB 정본 전환).
 *
 * **정본 = Postgres `gcal_event_ids`**(BBE-62, R7 Phase 2 #13). 시트 셀(04 미팅 **AT열** ·
 * 05 실무투두 **O열**, 값 = 사용자별 JSON 맵)은 **읽기 폴백 + 미러**로만 남는다 — 실제 열
 * 제거는 시트 은퇴(R7 Phase 4 #20).
 *
 * ## 전환 규칙 (BBE-58 과 같은 뼈대, 맵이라 병합 규칙이 하나 더)
 *  ① **키 단위 DB 우선 병합** — 읽기는 `시트맵 ∪ DB맵`이되 **같은 email 키는 DB 가 이긴다**.
 *     DB 의 `""`(tombstone)은 "지워짐"이라 결과에서 제외된다. 이 규칙이 있어야 미러가 실패해
 *     시트에 옛 값이 남아도 **지운 이벤트가 되살아나지 않는다**.
 *     (union 병합 자체는 lib/service/db.ts loadDBOverview 의 backfillMissingRows 선례와 동형.)
 *  ② **lazy backfill** — 시트에서 주운 키를 DB 에 1회 심는다(`do nothing`).
 *  ③ **DB 정본 + 시트 미러** — DB 실패=throw, 시트 미러 실패=warn. revert 안전(§6.8).
 *
 * ## 왜 삭제가 DELETE 가 아니라 tombstone 인가
 * `removeAll`(gcal-sync)이 **맵이 비면 아무 이벤트도 지우지 못한다** → 구글에 **영구 고아**가
 * 남는다(BBE-62 카드가 지목한 최대 위험). DB 행을 지우면 다음 읽기가 시트 폴백으로 옛 값을
 * 주워 되살리므로, 삭제는 `event_id=''` tombstone 으로 표현한다.
 *
 * ## 사라진 것
 * `withCellLock`(프로세스 내 셀 락) — 사용자별 행이 분리돼 lost update 가 **구조적으로 불가능**
 * 해졌다. 단일 pm2 인스턴스 전제도 함께 사라진다(카드의 "부수 효과"). 시트 미러 경로에는 남는다.
 *
 * ★설계(위험 최소화, 유지): meetings.ts/todos.ts 의 행 쓰기(writeMeetingRowSplit 은 A:M/P/R/
 * T:AN/AQ:AS, writeTodoRow 는 A:N)는 이 컬럼을 **범위 밖**으로 두어 안 건드린다.
 */
import { SHEET_RANGES } from "@/config";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { dbEnabled } from "./db/client";
import {
  backfillGcalMapIfAbsent,
  keepOnlyMarkersInDb,
  readGcalMapFromDb,
  readGcalMapsFromDbBatch,
  tombstoneAllInDb,
  upsertGcalEventId,
} from "./db/gcal-event-ids-db";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

export type GcalEventKind = "meeting" | "todo";

/**
 * 일정별 "캘린더에서 뺌" 표식. 저장 계층(시트 셀 값·DB event_id)의 규약이라 repo 가 정의하고
 * service(gcal-sync)가 가져다 쓴다 — BBE-62 전까지 양쪽에 각자 리터럴로 있던 것을 단일화
 * (레이어 규칙상 repo→service import 가 불가하므로 방향은 이쪽이 유일).
 */
export const EXCLUDE_MARKER = "-";

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

/**
 * "Range exceeds grid limits" 400 — gcal 컬럼(04 AT / 05 O)이 아직 생성 안 된 시트.
 * 컬럼 없음 = 매핑·마커 없음이므로 읽기 경로는 빈 값과 동치. 그리드 확장(ensureGridColumns)은
 * 쓰기 경로(setGcalEventId)만 수행 — 읽기에 쓰기 작업을 붙이지 않는다 (2026-07-12 카나리아 실측).
 */
function isGridLimitsError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: number; status?: number; message?: string };
  const is400 = err.code === 400 || err.status === 400;
  return is400 && /exceeds grid limits/i.test(String(err.message ?? ""));
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
  try {
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range: `${tabRef(tab)}!${col}${row}`,
    });
    return String(res.data.values?.[0]?.[0] ?? "").trim();
  } catch (e) {
    if (isGridLimitsError(e)) return ""; // 컬럼 미생성 시트 → 빈 셀과 동치
    throw e;
  }
}

/** 비치명 실패 경고 — DB 순단·미러 실패는 캘린더 동작을 멈추지 않는다. */
function warnNonFatal(what: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : "unknown";
  console.warn(`[gcal-event-ids] ${what} (동작은 계속): ${msg}`);
}

/**
 * 시트맵 ∪ DB맵 병합 — **같은 email 키는 DB 가 이기고**, DB 의 `""`(tombstone)은 결과에서 뺀다.
 * 불변식① 의 구현부. 순수 함수(테스트 대상).
 */
export function mergeGcalMaps(
  sheetMap: Record<string, string>,
  dbMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...sheetMap };
  for (const [email, eventId] of Object.entries(dbMap)) {
    if (eventId === "") delete out[email]; // tombstone = 지워짐(시트 잔재보다 우선)
    else out[email] = eventId;
  }
  return out;
}

/** 시트 셀에서 맵 읽기(행 없으면 빈 맵) — 폴백·미러 경로 공용. */
async function readSheetMap(
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
 * 한 일정 행의 사용자별 eventId 맵 조회(없으면 빈 맵).
 * DB 정본 + 시트 폴백을 키 단위로 병합(불변식①) + 시트에만 있던 키는 DB 로 1회 이전(②).
 */
export async function readGcalMap(
  spreadsheetId: string,
  kind: GcalEventKind,
  id: string,
): Promise<Record<string, string>> {
  const sheetMap = await readSheetMap(spreadsheetId, kind, id);
  if (!dbEnabled()) return sheetMap;

  let dbMap: Record<string, string> = {};
  try {
    dbMap = await readGcalMapFromDb(spreadsheetId, kind, id);
  } catch (e) {
    warnNonFatal("DB 조회 실패 → 시트 단독", e);
    return sheetMap;
  }
  // ② 시트에만 있는 키를 DB 로 이전(fire-and-forget). 이미 DB 에 있는 키는 do-nothing 이라 무해.
  const missing = Object.fromEntries(
    Object.entries(sheetMap).filter(([email]) => !(email in dbMap)),
  );
  if (Object.keys(missing).length) {
    void backfillGcalMapIfAbsent(spreadsheetId, kind, id, missing).catch((e) =>
      warnNonFatal("DB lazy backfill 실패", e),
    );
  }
  return mergeGcalMaps(sheetMap, dbMap);
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
  let res;
  try {
    res = await sheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [`${tabRef(tab)}!A2:A`, `${tabRef(tab)}!${col}2:${col}`],
    });
  } catch (e) {
    if (isGridLimitsError(e)) {
      // 컬럼 미생성 시트 → 제외 마커도 존재 불가 → 전원 기본 ON
      for (const id of ids) out[id] = true;
      return out;
    }
    throw e;
  }
  const idCol = res.data.valueRanges?.[0]?.values ?? [];
  const mapCol = res.data.valueRanges?.[1]?.values ?? [];

  // DB 정본을 배치로 한 번에(불변식①) — 실패해도 시트 단독으로 계속.
  let dbMaps = new Map<string, Record<string, string>>();
  if (dbEnabled()) {
    dbMaps = await readGcalMapsFromDbBatch(spreadsheetId, kind, ids).catch((e) => {
      warnNonFatal("DB 배치 조회 실패 → 시트 단독", e);
      return new Map<string, Record<string, string>>();
    });
  }

  const wanted = new Set(ids);
  for (let i = 0; i < idCol.length; i++) {
    const rid = String(idCol[i]?.[0] ?? "").trim();
    if (!rid || !wanted.has(rid) || rid in out) continue;
    const sheetMap = parseMap(String(mapCol[i]?.[0] ?? "").trim());
    const merged = mergeGcalMaps(sheetMap, dbMaps.get(rid) ?? {});
    out[rid] = merged[email] !== EXCLUDE_MARKER;
  }
  // 시트 행을 못 찾은 id 도 DB 에는 마커가 있을 수 있다(행 조회 실패·컬럼 미생성 시트).
  for (const id of ids) {
    if (id in out) continue;
    const dbMap = dbMaps.get(id);
    out[id] = dbMap ? dbMap[email] !== EXCLUDE_MARKER : true; // 미발견=기본 ON
  }
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
  // 정본(DB) 먼저 — 실패는 throw(호출부 gcal-sync 의 guard 가 재시도·warn 처리).
  // eventId=null(키 제거) 은 tombstone("")으로 표현한다(행 삭제 금지 — 헤더 참조).
  if (dbEnabled()) {
    await upsertGcalEventId(spreadsheetId, kind, id, email, eventId ?? "");
  }
  try {
    await mirrorSetToSheet(spreadsheetId, kind, id, email, eventId);
  } catch (e) {
    if (!dbEnabled()) throw e; // DB 없는 환경 = 시트가 정본
    warnNonFatal("시트 미러 실패 — setGcalEventId(DB 정본은 저장됨)", e);
  }
}

/** 시트 미러 — 기존 read-merge-write 그대로(타 사용자 키 보존). 셀 락도 시트 경로에만 유지. */
async function mirrorSetToSheet(
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
  if (dbEnabled()) await tombstoneAllInDb(spreadsheetId, kind, id); // 정본 — DELETE 아님(헤더)
  try {
    const { tab, col } = SPEC[kind];
    await withCellLock(`${spreadsheetId}:${kind}:${id}`, async () => {
      const row = await findRow(spreadsheetId, tab, id);
      if (row === null) return;
      await writeCell(spreadsheetId, tab, col, row, "");
    });
  } catch (e) {
    if (!dbEnabled()) throw e;
    warnNonFatal("시트 미러 실패 — clearGcalCell(DB 정본은 저장됨)", e);
  }
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
  if (dbEnabled()) await keepOnlyMarkersInDb(spreadsheetId, kind, id, EXCLUDE_MARKER); // 정본
  try {
    const { tab, col } = SPEC[kind];
    await withCellLock(`${spreadsheetId}:${kind}:${id}`, async () => {
      const row = await findRow(spreadsheetId, tab, id);
      if (row === null) return;
      const map = parseMap(await readCell(spreadsheetId, tab, col, row));
      const kept: Record<string, string> = {};
      for (const [k, v] of Object.entries(map)) if (v === EXCLUDE_MARKER) kept[k] = v;
      const json = Object.keys(kept).length ? `'${JSON.stringify(kept)}` : "";
      await writeCell(spreadsheetId, tab, col, row, json);
    });
  } catch (e) {
    if (!dbEnabled()) throw e;
    warnNonFatal("시트 미러 실패 — keepOnlyMarkers(DB 정본은 저장됨)", e);
  }
}
