/**
 * Layer: repo — 04 업체관리 행 코덱 (meetings.ts 에서 무동작 추출, R3-2 500줄 캡).
 *
 * Meeting ↔ 시트 행 배열(A~AS, 45셀) 변환 + 컬럼 좌표 상수. googleapis 비접촉(순수 함수).
 * I/O(append/update/clear/find)는 meetings.ts — 외부 임포터는 meetings.ts 재수출을 계속 사용.
 *
 * SSOT: docs/domains/sheet-structure.md §3
 */
import { Meeting, MeetingState } from "@/types";

// ── 시트 직렬값 ↔ ISO 변환 — USER_ENTERED 자동 변환분을 SERIAL_NUMBER 로 받아 ISO 복원.

export function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // 이미 ISO
    const d = new Date(v); // "M/D/YYYY" 등 변종
    if (!Number.isNaN(d.getTime())) return toISO(d);
    return "";
  }
  if (typeof v === "number") {
    // Sheets serial: days since 1899-12-30
    const ms = (v - 25569) * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return toISO(d);
  }
  return "";
}

export function serialToHHMM(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{2}:\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{2}):(\d{2})/); // "10:00:00" → "10:00"
    if (m) return `${m[1]}:${m[2]}`;
    return "";
  }
  if (typeof v === "number") {
    const fraction = ((v % 1) + 1) % 1; // 하루 중 비율(음수 안전, 날짜+시간 결합 허용)
    const totalMinutes = Math.round(fraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// 컬럼 인덱스 (0-based, A=0)
export const COL = {
  id: 0,
  예약일: 1,
  예약시각: 2,
  미팅날짜: 3,
  미팅시간: 4,
  channel: 5,
  업체명: 6,
  장소: 7,
  예약비고: 8,
  상태: 9,
  계약여부: 10,
  수임비: 11,
  미팅사유: 12,
  표시상세: 13, // 수식 — 쓰기 안 함
  표시요약: 14, // 수식 — 쓰기 안 함
  계약조건: 15,
  계약합성라인: 16, // 수식 — 쓰기 안 함
  previousMeetingId: 17,
  주차: 18, // 수식 — 쓰기 안 함
} as const;

/** 시트 수식 소유 컬럼(N/O/Q/S) — split write 가 비접촉해야 하는 좌표 문서화. */
export const FORMULA_COL_INDICES = new Set<number>([
  COL.표시상세,
  COL.표시요약,
  COL.계약합성라인,
  COL.주차,
]);

// 업체정보 컬럼 순서 (T=19 ~ AM=38, 20필드) + 커스텀 JSON(AN=39). lib/types CompanyInfo 키와 일치.
export const COMPANY_FIELDS = [
  "개업일", "사업자구분", "사업자등록번호", "소재지", "소유여부",
  "업종주생산품목", "과년도매출", "금년도매출", "기대출사업자", "사대보험직원",
  "특허및인증", "업체기타메모",
  "대표자이름", "연락처통신사", "신용점수", "기대출개인", "자택주소지",
  "대표소유여부", "동종업계경력", "대표기타메모",
] as const;
export const COMPANY_FIELD_START = 19; // T
export const COMPANY_CUSTOM_COL = 39; // AN

// 확장 3필드 (AQ=42~AS=44 — AO~AP 이월깃발 뒤 append, field-grid 2026-06-11).
// 기존 과년도매출(Z)=표시 "Y-1" 키 유지 — 라이브 데이터 보존(컬럼 이동 금지).
export const COMPANY_FIELDS_EXT = [
  "대표자생년월일", "과년도매출Y2", "과년도매출Y3",
] as const;
export const COMPANY_EXT_START = 42; // AQ

/** meetingToRow 가 USER_ENTERED 오변환 방지용으로 선행 apostrophe(`'`)를 붙이는 컬럼 전체. */
const APOSTROPHE_ESCAPED_COL_INDICES = new Set<number>([
  COL.예약비고,
  COL.미팅사유,
  COL.계약조건,
  ...Array.from({ length: COMPANY_FIELDS.length }, (_, i) => COMPANY_FIELD_START + i),
  COMPANY_CUSTOM_COL,
  ...Array.from({ length: COMPANY_FIELDS_EXT.length }, (_, i) => COMPANY_EXT_START + i),
]);

function stripSheetTextEscape(v: unknown): unknown {
  return typeof v === "string" && v.startsWith("'") ? v.slice(1) : v;
}

/**
 * meetingToRow 출력을 "실제 USER_ENTERED 시트 쓰기를 거쳤다면 어떻게 보였을지"로 정규화.
 * carryover 처럼 시트를 거치지 않고 meetingToRow 결과를 non-sheet 목적지(jsonb 등)로
 * 직접 보내는 경로 전용 — listCarrySourceMeetings(진짜 시트 읽기) 결과에는 절대 적용하지
 * 않는다. 컬럼 인덱스 무관하게 전체 배열에 적용하면 회사명 등 원래 apostrophe 없는
 * 필드는 그대로 지나가고(meetingToRow 가 그 필드들엔 애초에 apostrophe 를 안 붙임),
 * escape 대상 컬럼만 정확히 벗겨진다(BBE-65 — arena-carryover.ts:96 이 만드는 raw 전용).
 */
export function stripUserEnteredEscapes(
  row: (string | number | boolean)[],
): (string | number | boolean)[] {
  return row.map((v, i) =>
    APOSTROPHE_ESCAPED_COL_INDICES.has(i) ? (stripSheetTextEscape(v) as string | number | boolean) : v,
  );
}

/** 행 배열 T~AN(+AQ~AS) → CompanyInfo (모든 필드 빈값이고 커스텀 없으면 undefined). */
function buildCompanyInfo(r: unknown[]): Record<string, unknown> | undefined {
  const ci: Record<string, unknown> = {};
  let any = false;
  COMPANY_FIELDS.forEach((f, i) => {
    const v = String(r[COMPANY_FIELD_START + i] ?? "").trim();
    ci[f] = v;
    if (v) any = true;
  });
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    const v = String(r[COMPANY_EXT_START + i] ?? "").trim();
    ci[f] = v;
    if (v) any = true;
  });
  const rawCustom = String(r[COMPANY_CUSTOM_COL] ?? "").trim();
  if (rawCustom) {
    try {
      ci.커스텀 = JSON.parse(rawCustom);
      any = true;
    } catch {
      /* 손상된 JSON 무시 */
    }
  }
  return any ? ci : undefined;
}

/** Meeting → 시트 1행 배열 (A~AS, 45셀). 수식·이월(AO/AP)·미설정은 빈 문자열. */
export function meetingToRow(m: Meeting): (string | number | boolean)[] {
  const row: (string | number | boolean)[] = new Array(45).fill("");
  row[COL.id] = m.id;
  row[COL.예약일] = m.예약일;
  row[COL.예약시각] = m.예약시각;
  row[COL.미팅날짜] = m.미팅날짜;
  row[COL.미팅시간] = m.미팅시간;
  row[COL.channel] = m.channel;
  row[COL.업체명] = m.업체명;
  row[COL.장소] = m.장소;
  // 예약비고도 자유 텍스트 — plain text 강제.
  row[COL.예약비고] = m.예약비고 ? `'${m.예약비고}` : "";
  row[COL.상태] = m.상태;
  row[COL.계약여부] = m.계약여부;
  row[COL.수임비] = m.수임비;
  // 미팅사유도 자유 텍스트 — 동일하게 plain text 강제 (apostrophe prefix).
  row[COL.미팅사유] = m.미팅사유 ? `'${m.미팅사유}` : "";
  // 계약조건 자유 텍스트 — apostrophe prefix 로 plain text 강제("5%"→0.05 오변환 방지).
  row[COL.계약조건] = m.계약조건 ? `'${m.계약조건}` : "";
  row[COL.previousMeetingId] = m.previousMeetingId ?? "";
  // 업체정보 T~AN — 자유 텍스트는 apostrophe prefix(USER_ENTERED 오변환 방지). 빈값은 빈 셀.
  const ci = m.업체정보 as Record<string, unknown> | undefined;
  COMPANY_FIELDS.forEach((f, i) => {
    const v = ci ? String(ci[f] ?? "").trim() : "";
    row[COMPANY_FIELD_START + i] = v ? `'${v}` : "";
  });
  const customJson = m.업체정보?.커스텀
    ? JSON.stringify(m.업체정보.커스텀)
    : "";
  row[COMPANY_CUSTOM_COL] =
    customJson && customJson !== "{}" ? `'${customJson}` : "";
  // 확장 3필드 AQ~AS (AO/AP 이월깃발은 항상 빈 문자열 — split write 가 비접촉)
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    const v = ci ? String(ci[f] ?? "").trim() : "";
    row[COMPANY_EXT_START + i] = v ? `'${v}` : "";
  });
  // 표시상세/표시요약/계약합성라인/주차는 시트 수식이 채움 → 빈 문자열 유지
  return row;
}

/** 시트 1행 배열 → Meeting (parse 실패 시 null). */
export function rowToMeeting(r: unknown[]): Meeting | null {
  const idStr = String(r[COL.id] ?? "");
  if (!idStr) return null;

  const parsed = Meeting.safeParse({
    id: idStr,
    예약일: serialToISODate(r[COL.예약일]),
    예약시각: serialToHHMM(r[COL.예약시각]),
    미팅날짜: serialToISODate(r[COL.미팅날짜]),
    미팅시간: serialToHHMM(r[COL.미팅시간]),
    channel: String(r[COL.channel] ?? ""),
    업체명: String(r[COL.업체명] ?? ""),
    장소: String(r[COL.장소] ?? ""),
    예약비고: String(r[COL.예약비고] ?? ""),
    상태: (r[COL.상태] ?? "예약") as MeetingState,
    계약여부: r[COL.계약여부] === true || r[COL.계약여부] === "TRUE",
    수임비: Number(r[COL.수임비] ?? 0),
    미팅사유: String(r[COL.미팅사유] ?? ""),
    계약조건: String(r[COL.계약조건] ?? ""),
    표시상세: r[COL.표시상세] ? String(r[COL.표시상세]) : undefined,
    표시요약: r[COL.표시요약] ? String(r[COL.표시요약]) : undefined,
    계약합성라인: r[COL.계약합성라인] ? String(r[COL.계약합성라인]) : undefined,
    previousMeetingId: r[COL.previousMeetingId]
      ? String(r[COL.previousMeetingId])
      : undefined,
    주차: r[COL.주차] ? Number(r[COL.주차]) : undefined,
    업체정보: buildCompanyInfo(r),
    // AO~AP 이월 깃발 (arena-carryover §3) — 읽기 전용. 쓰기(split A:M/P/R/T~AN)는 비접촉.
    구분: String(r[40] ?? "").trim(),
    이월원본행id: String(r[41] ?? "").trim(),
  });
  return parsed.success ? parsed.data : null;
}
