/**
 * Layer: repo — 05 실무투두 탭 I/O.
 * 1행 = 1투두. 13컬럼 A~M. (계약 × 기관) 단위 ToDo.
 *
 * 04 미팅·02 수납과 완전 격리 (미팅 집계 수식 영향 0, ADR-0006).
 * 수식 컬럼 없음 → meetings 의 split-write 불필요, 전체 행 A:M 한 번에 write.
 *
 * 신규 탭이라 사전 존재 가정 X → ensureTodoTab 으로 lazy 자동 생성
 * (탭 없으면 addSheet + 헤더). cohorts.ts:ensureCohortsTab 패턴.
 * update 는 자기 id 행만, append 는 빈 행만 → 타 사용자값 침범 0
 * (bulk-write 가드 §2-5 정신 준수; values.update 단일 행이라 가드 비대상).
 *
 * SSOT: docs/domains/sheet-structure.md §5-2
 */
import { SHEET_RANGES } from "@/config";
import { Todo, type TodoType } from "@/types";
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── 시트 직렬값 ↔ ISO 변환 (meetings.ts 와 동일 — repo 격리상 복제) ──
// USER_ENTERED 로 쓴 "2026-05-22" / "14:00" 은 시트가 날짜·시간 값으로
// 저장 → SERIAL_NUMBER 로 읽어 ISO/HHMM 복원.

function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return toISO(d);
    return "";
  }
  if (typeof v === "number") {
    const ms = (v - 25569) * 86_400_000; // Sheets serial: days since 1899-12-30
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return toISO(d);
  }
  return "";
}

function serialToHHMM(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{2}:\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    return "";
  }
  if (typeof v === "number") {
    const fraction = ((v % 1) + 1) % 1; // 음수 안전
    const totalMinutes = Math.round(fraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

const TAB = SHEET_RANGES.todos.tab;
const RANGE_ALL = `${tabRef(TAB)}!${SHEET_RANGES.todos.range}`; // A2:N
const HEADER_RANGE = `${tabRef(TAB)}!${SHEET_RANGES.todos.headerRow}`; // A1:M1
const ID_COL_RANGE = `${tabRef(TAB)}!A2:A`;

// 컬럼 인덱스 (0-based, A=0)
const COL = {
  id: 0,
  contractRef: 1,
  institutionRef: 2,
  업체명: 3,
  type: 4,
  제목: 5,
  예정일자: 6,
  예정시각: 7,
  장소: 8,
  상세: 9,
  showOnCalendar: 10,
  완료여부: 11,
  생성시각: 12,
  분류: 13, // N — 일반이벤트 카테고리(기존/기타), consultation-log §1-3
} as const;

const HEADER: string[] = [
  "id",
  "contractRef",
  "institutionRef",
  "업체명",
  "type",
  "제목",
  "예정일자",
  "예정시각",
  "장소",
  "상세",
  "showOnCalendar",
  "완료여부",
  "생성시각",
  "분류",
];

/** 자유/키 텍스트는 apostrophe prefix 로 plain text 강제 (날짜·`%`·`=` 자동 변환 방지).
 *  Sheets 는 `'` 시작 입력을 텍스트로 저장하고 읽을 때 `'` 없이 원본 복원. */
function text(v: string): string {
  return v ? `'${v}` : "";
}

/** Todo → 시트 1행 배열 (A~N, 14칸). */
function todoToRow(t: Todo): (string | number | boolean)[] {
  const row: (string | number | boolean)[] = new Array(14).fill("");
  row[COL.id] = t.id;
  row[COL.contractRef] = text(t.contractRef);
  row[COL.institutionRef] = text(t.institutionRef);
  row[COL.업체명] = text(t.업체명);
  row[COL.type] = t.type;
  row[COL.제목] = text(t.제목);
  row[COL.예정일자] = t.예정일자; // 날짜 셀 의도 (USER_ENTERED 변환)
  row[COL.예정시각] = t.예정시각; // 시간 셀 의도 (빈 허용)
  row[COL.장소] = text(t.장소);
  row[COL.상세] = text(t.상세);
  row[COL.showOnCalendar] = t.showOnCalendar;
  row[COL.완료여부] = t.완료여부;
  row[COL.생성시각] = text(t.생성시각); // ISO 텍스트 (serial 변환 방지)
  row[COL.분류] = text(t.분류);
  return row;
}

/** 시트 1행 배열 → Todo (parse 실패 시 null). */
function rowToTodo(r: unknown[]): Todo | null {
  const idStr = String(r[COL.id] ?? "");
  if (!idStr) return null;

  const parsed = Todo.safeParse({
    id: idStr,
    contractRef: String(r[COL.contractRef] ?? ""),
    institutionRef: String(r[COL.institutionRef] ?? ""),
    업체명: String(r[COL.업체명] ?? ""),
    type: (r[COL.type] ?? "기타") as TodoType,
    제목: String(r[COL.제목] ?? ""),
    예정일자: serialToISODate(r[COL.예정일자]),
    예정시각: serialToHHMM(r[COL.예정시각]),
    장소: String(r[COL.장소] ?? ""),
    상세: String(r[COL.상세] ?? ""),
    // 기본 ON: 명시적 FALSE 만 false, 빈 셀/그 외는 true
    showOnCalendar: !(
      r[COL.showOnCalendar] === false || r[COL.showOnCalendar] === "FALSE"
    ),
    완료여부: r[COL.완료여부] === true || r[COL.완료여부] === "TRUE",
    생성시각: String(r[COL.생성시각] ?? ""),
    분류: String(r[COL.분류] ?? "").trim(),
  });
  return parsed.success ? parsed.data : null;
}

// ── 탭 자동 생성 ───────────────────────────────────────────────

// spreadsheetId 별 in-flight/완료 promise — 같은 프로세스의 동시 호출을 직렬화.
// 캘린더 month + 슬롯 listTodos + create 가 거의 동시에 ensureTodoTab 을 부르면
// "탭 존재 확인 → addSheet" TOCTOU race 로 셋 다 생성하여 "05 실무투두_conflictNNN"
// 중복 탭이 생기던 버그 (2026-06 QA). promise 캐시로 첫 호출만 실제 생성하도록 직렬화.
const ensuring = new Map<string, Promise<void>>();

/**
 * `05 실무투두` 탭 보장 (없으면 addSheet + 헤더행). 모든 read/write 진입 전 호출.
 * 동시 호출은 같은 promise 를 공유 → addSheet 는 1회만 (중복 탭 방지).
 */
export function ensureTodoTab(spreadsheetId: string): Promise<void> {
  let p = ensuring.get(spreadsheetId);
  if (!p) {
    p = doEnsureTodoTab(spreadsheetId).catch((e) => {
      ensuring.delete(spreadsheetId); // 실패 시 캐시 제거 → 다음 호출 재시도
      throw e;
    });
    ensuring.set(spreadsheetId, p);
  }
  return p;
}

async function doEnsureTodoTab(spreadsheetId: string): Promise<void> {
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === TAB);
  if (!exists) {
    // 다른 경로로 이미 동시 생성된 경우 Sheets 가 _conflict 탭을 만들 수 있으므로
    // addSheet 실패는 무시(이미 존재로 간주).
    try {
      await sheetsClient().spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: TAB } } }],
        },
      });
    } catch {
      /* 이미 존재 — 무시 */
    }
  }

  // 헤더 확인 → 없으면 write (RAW: 헤더 텍스트 자동 변환 방지).
  const header = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: HEADER_RANGE,
  });
  if (!header.data.values?.[0]?.[0]) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: HEADER_RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

// ── 행 위치 헬퍼 ───────────────────────────────────────────────

/** 헤더 다음 첫 빈 행 번호(1-based). A열(id) 기준 진짜 빈 행 탐색. */
async function findFirstEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: ID_COL_RANGE,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) return i + 2; // 데이터 시작 = 행 2
  }
  return ids.length + 2;
}

/** id로 행 번호 찾기 (1-based, 없으면 null). */
export async function findRowById(
  spreadsheetId: string,
  id: string,
): Promise<number | null> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: ID_COL_RANGE,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? ""));
  const idx = ids.indexOf(id);
  return idx < 0 ? null : idx + 2;
}

/** A~M 전체 행 write (수식 컬럼 없으므로 split 불필요). */
async function writeTodoRow(
  spreadsheetId: string,
  sheetRow: number,
  row: (string | number | boolean)[],
): Promise<void> {
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(TAB)}!A${sheetRow}:N${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

// ── Public API ─────────────────────────────────────────────────

/** id로 ToDo 조회. */
export async function findById(
  spreadsheetId: string,
  id: string,
): Promise<Todo | null> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) return null;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(TAB)}!A${sheetRow}:N${sheetRow}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const r = res.data.values?.[0];
  return r ? rowToTodo(r as unknown[]) : null;
}

/** ToDo 1건 append. id/생성시각은 호출(service) 측이 채워 전달. */
export async function appendTodo(
  spreadsheetId: string,
  todo: Todo,
): Promise<Todo> {
  await ensureTodoTab(spreadsheetId);
  const validated = Todo.parse(todo);
  const targetRow = await findFirstEmptyRow(spreadsheetId);
  await writeTodoRow(spreadsheetId, targetRow, todoToRow(validated));
  return validated;
}

/** 특정 ToDo 부분 update (자기 id 행만 read-merge-write). */
export async function updateTodo(
  spreadsheetId: string,
  id: string,
  partial: Partial<Omit<Todo, "id">>,
): Promise<void> {
  await ensureTodoTab(spreadsheetId);
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) {
    throw new Error(`[todos.ts] id를 찾을 수 없음: ${id}`);
  }
  const current = await findById(spreadsheetId, id);
  if (!current) {
    throw new Error(`[todos.ts] id로 행은 찾았으나 파싱 실패: ${id}`);
  }
  const merged: Todo = Todo.parse({ ...current, ...partial });
  await writeTodoRow(spreadsheetId, sheetRow, todoToRow(merged));
}

/** id로 행 클리어 (빈 값으로 update). */
export async function clearTodo(
  spreadsheetId: string,
  id: string,
): Promise<void> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) return;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(TAB)}!A${sheetRow}:N${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [Array(13).fill("")] },
  });
}

/** 한 계약(contractRef)에 속한 ToDo 전부 (슬롯 ToDo 섹션용). */
export async function listTodosByContract(
  spreadsheetId: string,
  contractRef: string,
): Promise<Todo[]> {
  await ensureTodoTab(spreadsheetId);
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const out: Todo[] = [];
  const seen = new Set<string>();
  for (const r of all) {
    const t = rowToTodo(r);
    if (!t || t.contractRef !== contractRef) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * 여러 날짜를 한 번의 read 로 조회 (캘린더 월간 뷰).
 * `showOnCalendar=true` & `예정일자 ∈ dates` 만. 빠진 날짜는 빈 배열.
 */
export async function findTodosByDateRange(
  spreadsheetId: string,
  dates: string[],
): Promise<Map<string, Todo[]>> {
  const wanted = new Set(dates);
  const result = new Map<string, Todo[]>();
  for (const d of dates) result.set(d, []);

  await ensureTodoTab(spreadsheetId);
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const seen = new Set<string>();
  for (const r of all) {
    const t = rowToTodo(r);
    if (!t || !t.showOnCalendar) continue;
    if (!wanted.has(t.예정일자)) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    result.get(t.예정일자)!.push(t);
  }
  return result;
}
