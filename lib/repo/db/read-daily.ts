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
import { Meeting } from "@/types";
import { rowToMeeting } from "../meetings";
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
