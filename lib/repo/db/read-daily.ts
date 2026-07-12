/**
 * Layer: repo — R2-2 컨택 탭 읽기 전환: meetings·db(현수막) DB read (db-read-meetings-banners).
 *
 * sheet_rows payload 는 **두 형태가 공존**한다 (같은 row_key 에 jsonb 병합):
 *   • dual-write(mirror.ts) = 필드명 키 — meetings: Meeting 객체 그대로(rowKey=A열 id),
 *     db 현수막: DBBanner 스프레드(rowKey=`현수막:r{행}`).
 *   • backfill(backfill-sheet-rows.mjs) = **열문자 키**(A.., P..) + `_backfill:true`,
 *     값은 전부 문자열화(직렬 날짜 "46042", boolean "true" 포함).
 * 앱을 거친 행은 필드명 키가 최신(병합 우선), backfill 만 된 과거 행은 열문자뿐 —
 * 여기서 두 형태를 모두 Meeting/주문개수 로 복원한다. 변환 정합은
 * tests/service/db-read-meetings-banners.test.ts 가 시트 경로와 대조 고정.
 *
 * R2-3(일정·계약 탭 loadWeekMeetings·캘린더)은 readMeetingsFromDb 를 재사용만 하면 됨.
 */
import { CompanyInfo, ContractPayment, Meeting, Todo } from "@/types";
import {
  COMPANY_FIELDS,
  COMPANY_FIELDS_EXT,
  rowToMeeting,
} from "../meetings";
import { rowToCP } from "../contract-payment";
import { rowToTodo } from "../todos";
import { companyContractRef } from "../company-info-archive";
import { dbEnabled, ensureSchema, getDbPool } from "./client";

/** 열 인덱스 → 시트 열문자 (backfill rowObj 의 colName 과 동일 규칙, AP=41 까지 충분). */
function colName(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
}

/** backfill 문자열 값 → 시트 UNFORMATTED 원형 복원(숫자 직렬·boolean). */
function coerce(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** payload(필드명/열문자 겸용) → Meeting. 실패(파싱 불가 행)는 null — 호출부에서 제외. */
export function meetingFromDbPayload(
  p: Record<string, unknown>,
): Meeting | null {
  // 1) dual-write 필드명 형태 우선(병합 시 최신) — Zod 가 미지 키(열문자 잔재) 제거.
  if (typeof p.id === "string" && p.id) {
    const direct = Meeting.safeParse(p);
    if (direct.success) return direct.data;
  }
  // 2) backfill 열문자 형태 → 행 배열 복원 후 시트 파서(rowToMeeting) 그대로 재사용.
  const r: unknown[] = [];
  for (let i = 0; i <= 44; i++) r.push(coerce(p[colName(i)]));
  return rowToMeeting(r);
}

/** payload → 현수막 주문개수. 필드명(주문개수) 우선, 열문자(T=인덱스 19) fallback. */
export function bannerOrderQtyFromDbPayload(
  p: Record<string, unknown>,
): number {
  const direct = Number(p["주문개수"]);
  if (Number.isFinite(direct) && p["주문개수"] !== undefined && p["주문개수"] !== "") {
    return direct;
  }
  const t = Number(p["T"]);
  return Number.isFinite(t) ? t : 0;
}

/** 한 시트의 미팅 전체 (04 미러, _cleared 제외). 정렬: 예약일→예약시각→id (결정적). */
export async function readMeetingsFromDb(
  spreadsheetId: string,
): Promise<Meeting[]> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'meetings'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  const out: Meeting[] = [];
  for (const { payload } of res.rows as { payload: Record<string, unknown> }[]) {
    const m = meetingFromDbPayload(payload);
    if (m) out.push(m);
  }
  out.sort((a, b) =>
    a.예약일 !== b.예약일 ? a.예약일.localeCompare(b.예약일)
    : a.예약시각 !== b.예약시각 ? a.예약시각.localeCompare(b.예약시각)
    : a.id.localeCompare(b.id),
  );
  return out;
}

// ── R2-4: contracts(02 계약수납) read (db-read-payments) ─────────────────────
// payload 3형태 공존: ① backfill = 열문자 C..AK(문자열화) ② updateUserFields 미러 =
// ContractPayment 전체(필드명) ③ append 미러 = 부분 필드명 {계약일,업체명,수임비,
// meetingId→AK, 구분, 원본행id→AJ}. 전략: 열문자로 A기준 행 배열 복원 → 필드명 키를
// 좌표에 overlay → 시트 파서 rowToCP 그대로 재사용(이월 깃발 AI/AJ·수납 1~3 포함 —
// 2026-07-07 이월 매출 누수 사고 계열의 재발을 파서 단일화로 차단).

/** ContractPayment 필드명 → A기준 열 인덱스 (cpToRow 좌표 + 이월/연결 확장 + 미러 이명). */
const CP_FIELD_IDX: Record<string, number> = {
  계약일: 2, 업체명: 3, 수임비: 4,
  공동인증서: 5, 임대차계약서: 6, 신분증: 7, 드라이브업로드: 8,
  사업계획서초안발송: 9, 컨설팅5종서류발송: 10, 플러그이관: 11,
  로드맵메모: 30,
  구분: 34, 이월원본행id: 35, 원본행id: 35, // append 미러는 "원본행id" 이명 사용
  linkedMeetingId: 36, meetingId: 36,       // append 미러는 "meetingId" 이명 사용
  해지일: 37, 해지사유: 38, 반환액: 39, 해지숨김: 40, // AL~AO 계약해지 (contract-termination)
};
const CP_SLOT_START: Record<string, { start: number; memo: number }> = {
  수납1: { start: 12, memo: 31 },
  수납2: { start: 18, memo: 32 },
  수납3: { start: 24, memo: 33 },
};

/** payload(3형태 겸용) → ContractPayment. rowNumber = row_key r{N} 의 N. */
export function contractFromDbPayload(
  p: Record<string, unknown>,
  rowNumber: number,
): ContractPayment | null {
  // 1) backfill 열문자(C 기준 저장 — 절대 열문자라 A기준 인덱스로 그대로 복원)
  const r: unknown[] = new Array(41).fill(""); // A~AO (해지 AL~AO 포함)
  for (let i = 2; i <= 40; i++) {
    const v = p[colName(i)];
    if (v !== undefined) r[i] = coerce(v);
  }
  // 2) 필드명 overlay (미러가 최신 — jsonb 병합상 나중 쓰기)
  for (const [k, idx] of Object.entries(CP_FIELD_IDX)) {
    if (p[k] !== undefined && p[k] !== null) r[idx] = p[k];
  }
  for (const [k, pos] of Object.entries(CP_SLOT_START)) {
    const s = p[k];
    if (s && typeof s === "object") {
      const o = s as Record<string, unknown>;
      if (o.진행기관 !== undefined) r[pos.start] = o.진행기관;
      if (o.진행률 !== undefined) r[pos.start + 1] = o.진행률;
      if (o.현황 !== undefined) r[pos.start + 2] = o.현황;
      if (o.승인금액 !== undefined) r[pos.start + 3] = o.승인금액;
      if (o.수납액 !== undefined) r[pos.start + 4] = o.수납액;
      if (o.수납일 !== undefined) r[pos.start + 5] = o.수납일;
      if (o.메모 !== undefined) r[pos.memo] = o.메모;
    }
  }
  return rowToCP(r, rowNumber);
}

/** 02 헤더존 정크 판정 (contract-delete-ghost, 2026-07-12).
 *
 * backfill 이 헤더·예시 구간(신형 r3~r5)을 적재한 사고의 방어선 — 시트 경로는
 * firstDataRow(신형 6/구형 5) 아래를 아예 읽지 않으므로, backfill 출신 행 중
 * 계약일이 날짜가 아닌 것(예: r3 "수납총액" 안내행)은 데이터 행일 수 없다.
 * 앱 dual-write 행(_backfill 없음)은 계약일이 항상 ISO/빈 값이라 비접촉 —
 * 시트 정합 유지. r5 "00유통" 예시행(날짜형)은 여기로 못 거르므로
 * repair-contracts-header-zone.mjs 가 _cleared 마킹으로 정리(재발은 backfill 수정이 차단). */
export function isContractHeaderZoneJunk(
  payload: Record<string, unknown>,
  cp: ContractPayment,
): boolean {
  if (payload._backfill !== true) return false;
  const d = cp.계약일.trim();
  return d !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** 한 시트의 02 계약수납 전체 (_cleared 제외) — readAll 동치. 행번호 오름차순(시트 순서). */
export async function readContractsFromDb(
  spreadsheetId: string,
): Promise<ContractPayment[]> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select row_key, payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'contracts'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  const out: ContractPayment[] = [];
  for (const { row_key, payload } of res.rows as {
    row_key: string;
    payload: Record<string, unknown>;
  }[]) {
    const n = Number(row_key.replace(/^r/, ""));
    if (!Number.isFinite(n)) continue;
    const cp = contractFromDbPayload(payload, n);
    if (cp && !isContractHeaderZoneJunk(payload, cp)) out.push(cp);
  }
  out.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return out;
}

// ── R2-6: todos(05 실무투두) read (db-read-calendar) — meetings 와 동일 구조(A열 id) ──
// payload 2형태: dual-write=Todo 필드명 / backfill=열문자 A..N(rowObj 기본 start 0).
// 열문자는 A..N → 행배열 복원 후 시트 파서 rowToTodo 재사용(showOnCalendar 기본 ON 규칙 포함).

/** payload(필드명/열문자 겸용) → Todo. 실패 null. */
export function todoFromDbPayload(p: Record<string, unknown>): Todo | null {
  if (typeof p.id === "string" && p.id) {
    const direct = Todo.safeParse(p);
    if (direct.success) return direct.data;
  }
  const r: unknown[] = [];
  for (let i = 0; i <= 13; i++) r.push(coerce(p[colName(i)])); // A..N
  return rowToTodo(r);
}

/** 한 시트의 05 실무투두 전체(_cleared 제외). 캘린더가 showOnCalendar·예정일자로 필터. */
export async function readTodosFromDb(spreadsheetId: string): Promise<Todo[]> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'todos'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  const out: Todo[] = [];
  for (const { payload } of res.rows as { payload: Record<string, unknown> }[]) {
    const t = todoFromDbPayload(payload);
    if (t) out.push(t);
  }
  return out;
}

/** R3-2: ToDo 1건의 DB 상태 — **_cleared 포함** 단건 조회. 없으면 null.
 * 쓰기 경로 전용: patch 의 "삭제됨 vs DB 공백" 구분(삭제면 self-heal 금지) +
 * 시트 수렴 동기화(최신 DB 상태 → 시트) 판단 기준. */
export async function readTodoRowStateFromDb(
  spreadsheetId: string,
  id: string,
): Promise<{ cleared: boolean; todo: Todo | null } | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'todos' and row_key = $2`,
    [spreadsheetId, id],
  );
  const payload = (res.rows[0] as { payload: Record<string, unknown> } | undefined)
    ?.payload;
  if (!payload) return null;
  return {
    cleared: payload._cleared === true,
    todo: todoFromDbPayload(payload),
  };
}

/** 현수막 Σ주문개수 (03 DB관리 현수막 섹션 미러, _cleared 제외) — ADR-0025 재고 base 입력. */
export async function readBannerOrderQtyFromDb(
  spreadsheetId: string,
): Promise<number> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'db' and row_key like '현수막:%'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  let sum = 0;
  for (const { payload } of res.rows as { payload: Record<string, unknown> }[]) {
    sum += bannerOrderQtyFromDbPayload(payload);
  }
  return sum;
}

// ── R2-4b: company_archive(06 업체정보) read (db-read-company-archive) ────────
// payload 형태: ① upsert 미러 = {업체명, 계약일, ...CompanyInfo 평탄화(커스텀 포함)}
// ② backfill = 열문자 A..AB(E..X=COMPANY_FIELDS, Y=커스텀 JSON 문자열, Z..AB=EXT)
// ③ rename 미러 = 키 필드만(스냅샷 없음) — 실질 빈 결과는 호출부가 시트 fallback
//   (renameCompanyInfoKey 는 시트 E~AB 를 보존하지만 DB 새 키엔 스냅샷이 없다).

const COMPANY_LETTER_START = 4; // E — 06 탭 A~AB 중 업체정보 시작 열

/** payload(3형태 겸용) → CompanyInfo. 파싱 불가 시 null. */
export function companyInfoFromDbPayload(
  p: Record<string, unknown>,
): CompanyInfo | null {
  const ci: Record<string, unknown> = {};
  COMPANY_FIELDS.forEach((f, i) => {
    const v = p[f] ?? p[colName(COMPANY_LETTER_START + i)];
    ci[f] = String(v ?? "").trim();
  });
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    // Z..AB = 커스텀(Y) 다음 3열
    const v = p[f] ?? p[colName(COMPANY_LETTER_START + COMPANY_FIELDS.length + 1 + i)];
    ci[f] = String(v ?? "").trim();
  });
  const custom = p["커스텀"];
  if (custom && typeof custom === "object") {
    ci.커스텀 = custom; // upsert 미러 — 객체 그대로
  } else {
    const raw = String(p[colName(COMPANY_LETTER_START + COMPANY_FIELDS.length)] ?? "").trim();
    if (raw) {
      try { ci.커스텀 = JSON.parse(raw); } catch { /* 손상 JSON 무시 — 시트 read 와 동일 */ }
    }
  }
  const parsed = CompanyInfo.safeParse(ci);
  return parsed.success ? parsed.data : null;
}

/** 06 키(계약ref) 행의 업체정보 — readCompanyInfoArchiveRow 동치. 행 없으면 null. */
export async function readCompanyInfoFromDb(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
): Promise<CompanyInfo | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'company_archive' and row_key = $2
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId, companyContractRef(계약일, 업체명)],
  );
  const payload = (res.rows[0] as { payload: Record<string, unknown> } | undefined)?.payload;
  if (!payload) return null;
  return companyInfoFromDbPayload(payload);
}
