/**
 * 「통화 정리 확인」 규칙(plan call-summary PR-5b, 목업 통화확인_목업.html) — 화면과 떨어진 순수 함수.
 * 칸마다 지금 값과 비교: 빈칸 채움(기본 체크) · 지금 값 있음(기본 해제, 체크하면 바뀜) · 지금 값과 같아요(체크 불가).
 * 민감 칸(신용점수·기대출개인)도 같은 규칙(belie 2026-10-31: 빈칸이면 체크).
 * 매출 칸은 통화 연도 기준으로 정리돼 오므로, 업체에 기준 연도가 이미 있으면 그 기준으로 옮기고 기준 연도는 건드리지 않는다
 * — 그대로 덮으면 기존 매출 숫자가 한 해씩 밀려 읽힌다.
 */
import type { CompanyInfo } from "@/types";
import { CALL_SENSITIVE_FIELDS, type CallExtraction, type CallRecord } from "@/types/call";
import type { DB_SHEET_RESULTS } from "@/types/db-sheet";
export type DbSheetResult = (typeof DB_SHEET_RESULTS)[number];
import { companyInfoFieldList } from "@/components/company-info-defs";
import { SALES_YEAR_KEYS, salesSlotOf } from "@/util/company-sales";
import { eul } from "./call-client";

export type CiStatus = "new" | "keep" | "same";
export type CiRow = {
  key: string; label: string; group: "대표자" | "기업정보" | "재무" | "추가 칸"; custom: boolean;
  value: string; current: string; status: CiStatus; sensitive: boolean; evidence: string; checked: boolean;
};

const OWNER_KEYS = new Set(["대표자이름", "신용점수", "기대출개인"]);
const FINANCE_KEYS = new Set<string>([...SALES_YEAR_KEYS, "기대출사업자"]);
const norm = (s: string) => s.replace(/\s+/g, "");
const kstYear = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).getUTCFullYear();

/** 통화 연도 기준 매출 칸 → 업체 기준 연도 칸. 4년 칸 밖으로 나가는 해는 dropped 로 돌려준다. */
/** from = 옮긴 칸 → 원래 칸(근거 문장을 찾을 때). */
export function rebaseSales(company: Record<string, string>, callYear: number, baseYear: number): { company: Record<string, string>; dropped: number[]; from: Record<string, string> } {
  const out: Record<string, string> = {}, dropped: number[] = [], from: Record<string, string> = {};
  for (const [k, v] of Object.entries(company)) {
    const ago = (SALES_YEAR_KEYS as readonly string[]).indexOf(k);
    if (ago < 0) { out[k] = v; from[k] = k; continue; }
    const slot = salesSlotOf(callYear - ago, baseYear);
    if (slot === null) dropped.push(callYear - ago); else { out[SALES_YEAR_KEYS[slot]!] = v; from[SALES_YEAR_KEYS[slot]!] = k; }
  }
  return { company: out, dropped, from };
}

/** 확인 화면의 업체정보 줄. baseYear = 업체 기준 연도(없으면 통화 연도 — 확정하면 그 값이 저장된다). */
export function buildCiRows(call: Pick<CallRecord, "calledAt">, x: CallExtraction, ci: CompanyInfo): { rows: CiRow[]; baseYear: number; dropped: number[] } {
  const callYear = kstYear(call.calledAt);
  const baseYear = Number(ci.매출기준연도) || callYear;
  const { company, dropped, from } = rebaseSales(Object.fromEntries(Object.entries(x.company).filter(([k, v]) => k !== "매출기준연도" && typeof v === "string" && v)) as Record<string, string>, callYear, baseYear);
  const labels = new Map(companyInfoFieldList(baseYear));
  const order = [...labels.keys()] as string[];
  const ev = (k: string) => x.evidence[k] ?? "";
  const row = (key: string, value: string, current: string, custom: boolean, evidenceKey: string): CiRow => {
    const status: CiStatus = !current.trim() ? "new" : norm(current) === norm(value) ? "same" : "keep";
    return {
      key, value, current, custom, status, checked: status === "new", evidence: ev(evidenceKey),
      label: custom ? key : labels.get(key as keyof CompanyInfo) ?? key,
      group: custom ? "추가 칸" : OWNER_KEYS.has(key) ? "대표자" : FINANCE_KEYS.has(key) ? "재무" : "기업정보",
      sensitive: (CALL_SENSITIVE_FIELDS as readonly string[]).includes(key),
    };
  };
  const rows = Object.entries(company)
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999))
    .map(([k, v]) => row(k, v, String((ci as Record<string, unknown>)[k] ?? ""), false, from[k] ?? k));
  const currentCustom = ci.커스텀?.업체 ?? {};
  for (const [k, v] of Object.entries(x.custom)) rows.push(row(k, v, currentCustom[k] ?? "", true, `custom.${k}`));
  return { rows, baseYear, dropped };
}

/** 가이드 질문 1~12 중 빠진 번호. */
export const missingQuestions = (answered: number[]) => Array.from({ length: 12 }, (_, i) => i + 1).filter(n => !answered.includes(n));

/** 상담메모 초안 — 지금 메모가 있으면 그 아래에 AI 메모를 붙인다(이 화면에서 고친다). */
export const noteDraft = (current: string, memo: string) => [current.trim(), memo.trim()].filter(Boolean).join("\n\n");

export type MeetingDraft = { meetingDate: string; time: string; place: string; reservationNote: string };
export type ConfirmState = {
  revision: number; date: string; result: DbSheetResult | ""; note: string; rows: CiRow[]; baseYear: number; hasBaseYear: boolean;
  meetingOn: boolean; meeting: MeetingDraft; lead: CallExtraction["lead"];
};

/** 확정 전 막는 이유(없으면 ""). */
export function confirmBlocker(s: ConfirmState): string {
  if (s.meetingOn) {
    const miss = [!s.meeting.meetingDate && "날짜", !s.meeting.time && "시간", !s.meeting.place.trim() && "장소"].filter(Boolean);
    if (miss.length) return `미팅 ${eul(miss.join("·"))} 정해 주세요`;
  } else if (!s.result) return "컨택결과를 골라 주세요";
  return "";
}

/** POST /api/calls/[id]/confirm 본문. 체크한 칸만, 매출을 넣으면 기준 연도가 없을 때만 함께 넣는다. */
export function confirmBody(s: ConfirmState) {
  const picked = s.rows.filter(r => r.checked && r.status !== "same");
  const company: Record<string, string> = Object.fromEntries(picked.filter(r => !r.custom).map(r => [r.key, r.value.trim()]));
  if (!s.hasBaseYear && picked.some(r => (SALES_YEAR_KEYS as readonly string[]).includes(r.key))) company.매출기준연도 = String(s.baseYear);
  return {
    revision: s.revision, date: s.date, result: s.meetingOn ? "컨택진행" : s.result, note: s.note,
    company, custom: Object.fromEntries(picked.filter(r => r.custom).map(r => [r.key, r.value.trim()])),
    lead: s.lead, meeting: s.meetingOn ? s.meeting : null,
  };
}

/** 15분 단위 시간 선택지 08:00~21:45. 지금 값이 목록 밖이면 앞에 끼운다. */
export function timeOptions(current: string): string[] {
  const out: string[] = [];
  for (let m = 8 * 60; m < 22 * 60; m += 15) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return current && !out.includes(current) ? [current, ...out] : out;
}
