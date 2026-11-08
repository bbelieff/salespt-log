/**
 * 간편인증 서류 조회 목업 — 합성 데이터와 상태 모델(2026-11-08).
 * 실제 고객·업체·제공사 응답이 아니다. 화면 흐름 확인용.
 */
import type { CompanyInfoKey } from "@/lib/document-ocr/types";

export const AUTH_METHODS = ["카카오톡", "네이버", "PASS", "토스", "삼성패스", "KB모바일"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];
export const TELECOMS = ["SKT", "KT", "LG U+"] as const;
export const CONSENT_WAYS = ["통화", "대면", "문자"] as const;

export type DocKey = "biz" | "vat" | "fs" | "tax" | "income" | "ins";
export const DOCS: { key: DocKey; label: string; note?: string; extraAuth?: boolean }[] = [
  { key: "biz", label: "사업자등록증명" },
  { key: "vat", label: "부가세 과세표준증명", note: "최근 3년" },
  { key: "fs", label: "표준재무제표증명", note: "직전 연도" },
  { key: "tax", label: "납세증명(국세 완납)" },
  { key: "income", label: "소득금액증명", note: "개인사업자" },
  { key: "ins", label: "4대보험 가입자 명부", extraAuth: true },
];
export const DEFAULT_DOCS: DocKey[] = ["biz", "vat", "fs", "tax"];
export const docLabel = (k: DocKey) => DOCS.find(d => d.key === k)?.label ?? k;

export type DocResult = { key: DocKey; ok: boolean; reason?: string; issuedAt?: string; facts: string[] };

export type ReqStatus = "waiting" | "scraping" | "done" | "expired" | "canceled";
export type AuthRequest = {
  id: string;
  company: string;
  owner: string; // 화면에는 가린 이름만
  phone: string; // 가린 번호만
  method: AuthMethod;
  docs: DocKey[];
  status: ReqStatus;
  sentAt: string; // "11-08 14:02"
  deadline: number; // 승인 대기 마감(ms)
  resends: number;
  results: DocResult[];
};

export const WAIT_LIMIT_MS = 270_000; // CODEF 간편인증 대기 4분 30초

export const maskName = (n: string) => (n.length <= 1 ? n : n.length === 2 ? `${n[0]}*` : `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`);
export const maskPhone = (p: string) => p.replace(/^(\d{3})-?(\d{3,4})-?(\d{4})$/, "$1-****-$3");

const FACTS: Record<DocKey, string[]> = {
  biz: ["개업일 2019-03-11", "업태 제조업 · 종목 금속가공"],
  vat: ["2025년 과세표준 1,284,500,000원", "2024년 과세표준 1,012,300,000원"],
  fs: ["2025년 매출액 1,301,000,000원", "영업이익 96,400,000원 · 자산총계 2,050,000,000원"],
  tax: ["국세 체납 없음"],
  income: ["2025년 사업소득 84,200,000원"],
  ins: ["가입자 12명 (고용보험 기준)"],
};
export function resultFor(key: DocKey, fail = false): DocResult {
  if (fail) return { key, ok: false, reason: key === "fs" ? "아직 신고되지 않은 연도예요. 결산 신고 뒤 다시 요청해 주세요." : "홈택스가 잠시 응답하지 않았어요.", facts: [] };
  return { key, ok: true, issuedAt: "2026-11-08", facts: FACTS[key] };
}

/** 고객 승인 뒤 업체정보 칸에 반영할 수 있는 값(합성). */
export const PROPOSAL: { key: CompanyInfoKey; value: string; source: DocKey }[] = [
  { key: "개업일", value: "2019-03-11", source: "biz" },
  { key: "업태", value: "제조업", source: "biz" },
  { key: "과년도매출", value: "1284.5", source: "vat" },
  { key: "과년도매출Y2", value: "1012.3", source: "vat" },
  { key: "영업이익", value: "96.4", source: "fs" },
  { key: "자산총계", value: "2050", source: "fs" },
];
/** 비교표 칸 이름 — 실제 구현은 「문서로 자동입력」과 같은 companyInfoFieldList·기준연도 라벨을 쓴다. */
export const FIELD_LABEL: Record<string, string> = { 개업일: "개업일", 업태: "업태", 과년도매출: "2025년 매출", 과년도매출Y2: "2024년 매출", 영업이익: "영업이익", 자산총계: "자산총계" };
export const CURRENT_INFO ={ 개업일: "2019-03-11", 업태: "", 과년도매출: "1200", 과년도매출Y2: "", 영업이익: "", 자산총계: "" };

let seq = 100;
export const nextId = () => `req-${++seq}`;

/** 처음 열었을 때 보이는 예시 목록(합성). */
export function seedRequests(now: number): AuthRequest[] {
  const all = DEFAULT_DOCS;
  return [
    { id: "req-1", company: "한빛정밀", owner: maskName("김도윤"), phone: maskPhone("010-2481-5678"), method: "카카오톡", docs: [...all, "income"], status: "waiting", sentAt: "11-08 14:02", deadline: now + 192_000, resends: 0, results: [] },
    { id: "req-2", company: "주식회사 서해바다수산물유통가공영농조합법인 제2공장", owner: maskName("남궁민수"), phone: maskPhone("010-9934-1207"), method: "네이버", docs: all, status: "done", sentAt: "11-08 11:40", deadline: 0, resends: 0, results: [resultFor("biz"), resultFor("vat"), resultFor("fs", true), resultFor("tax")] },
    { id: "req-3", company: "그린카페", owner: maskName("이서연"), phone: maskPhone("010-5512-8890"), method: "PASS", docs: ["biz", "vat"], status: "expired", sentAt: "11-07 17:15", deadline: 0, resends: 1, results: [] },
    { id: "req-4", company: "대성철강", owner: maskName("박준호"), phone: maskPhone("010-3320-4471"), method: "토스", docs: all, status: "done", sentAt: "11-07 10:05", deadline: 0, resends: 0, results: all.map(k => resultFor(k)) },
  ];
}
