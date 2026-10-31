/**
 * 통화 정리 (call-summary, belie 2026-10-31). DB관리시트 한 건의 통화 녹음 → AI 정리 → 「통화 정리 확인」 → 확정 저장.
 * AI 는 들은 말만 내고 백만원 환산·연도 칸·15분 맞춤은 코드가 한다. 확정 전에는 DB정보·미팅·지표에 아무것도 쓰지 않는다.
 * SSOT: data-model.md · plan docs/plans/active/call-summary.md.
 */
import { z } from "zod";
import { CompanyInfo } from "./meeting";

/**
 * dialed(DB관리시트 📞 버튼으로 전화 걸음 — 녹음 아직 없음) → queued(녹음 올림) → processing(글자 변환·정리) → review(확인 대기)
 * → confirmed(확정 저장) · failed(사유) · discarded(저장 안 하고 닫음).
 */
export const CallStatus = z.enum(["dialed", "queued", "processing", "review", "confirmed", "failed", "discarded"]);
export type CallStatus = z.infer<typeof CallStatus>;

/** 컨택 가이드 질문 번호(1~12) — 확인 화면의 「12개 중 N개 답함」. */
export const CallGuideQuestion = z.number().int().min(1).max(12);

/** 통화에서 뽑지 않는 업체정보 칸(D4) — 집 주소·주민번호는 어떤 경로로도 통화 정리에 실리지 않는다. */
export const CALL_EXCLUDED_FIELDS = ["자택주소지", "주민등록번호"] as const;
/** 뽑되 「민감」 표시하는 칸(D4) — 확인 화면에서 따로 보이고, 빈칸이면 기본 체크. */
export const CALL_SENSITIVE_FIELDS = ["신용점수", "기대출개인"] as const;

const text = (max: number) => z.string().max(max).default("");

/** 업체정보 제안 — CompanyInfo 칸 중 통화 제외 칸·커스텀 JSON 을 뺀 부분. 저장 형식(백만원 "3,200" 등)으로 변환된 값. */
export const CallCompanyInfo = CompanyInfo.omit({ 자택주소지: true, 주민등록번호: true, 커스텀: true }).partial();
export type CallCompanyInfo = z.infer<typeof CallCompanyInfo>;

/** 미팅 초안 — DbSheetContact 의 미팅 칸과 같은 이름. 시간이 정해지지 않았으면 time="". */
export const CallMeetingDraft = z.object({
  meetingDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).default(""),
  time: z.union([z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/), z.literal("")]).default(""),
  place: text(200),
  reservationNote: text(500),
});
export type CallMeetingDraft = z.infer<typeof CallMeetingDraft>;

/** 정리 결과(코드 변환 후). 확인 화면이 이 값을 고칠 수 있게 보여 준다. */
export const CallExtraction = z.object({
  summary: z.array(z.string().max(200)).max(3).default([]),
  /** 상담메모 초안 — DbSheetContact.note 에 덧붙인다. */
  memo: text(2000),
  answered: z.array(CallGuideQuestion).default([]),
  /** DB 원본 칸 제안(비어 있을 때만 채움). */
  lead: z.object({ company: text(200), owner: text(100) }).partial().default({}),
  company: CallCompanyInfo.default({}),
  /** 사용자 추가 칸(커스텀.업체) — 필요자금·자금 사용 목적·수출·배달·키오스크. */
  custom: z.record(z.string().max(40), z.string().max(500)).default({}),
  meeting: CallMeetingDraft.nullable().default(null),
  /** 칸 이름 → 그 값의 근거 문장(통화 원문에서 그대로). 근거 없는 칸은 변환 단계에서 버린다. */
  evidence: z.record(z.string(), z.string().max(500)).default({}),
});
export type CallExtraction = z.infer<typeof CallExtraction>;

/** call_records 한 줄(0014). 녹음 원본은 글자 변환 직후 지우고 경로만 비운다(D3). */
export type CallRecord = {
  id: string;
  spreadsheetId: string;
  leadId: string;
  email: string;
  status: CallStatus;
  /** 📞 버튼을 누른 시각(ISO) — 「다음 주 수요일」 같은 말을 날짜로 바꾸는 기준. */
  calledAt: string;
  audioSeconds: number | null;
  transcript: string;
  extraction: CallExtraction | null;
  error: string;
  attempts: number;
  createdAt: string;
  confirmedAt: string | null;
};
