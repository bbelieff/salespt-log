/**
 * 간편인증 서류 조회 목업 — 합성 데이터와 상태 모델(2026-11-08).
 * 실제 고객·업체·제공사 응답이 아니다. 화면 흐름 확인용.
 * 흐름(belie 2026-11-08): 업체를 먼저 고르지 않는다 — 인증부터 보내고, 서류가 오면 사업자마다 DB 관리시트에 연결한다.
 * 한 대표가 사업자를 여러 개 가졌으면 모든 계속사업장의 서류가 한 번에 온다(CODEF 실측: 사업자등록증명 2건).
 */
import type { CompanyInfoKey } from "@/lib/document-ocr/types";
import { isSimilarDbSheetCompany } from "@/types/db-sheet";

export const AUTH_METHODS = ["카카오톡", "네이버", "PASS", "토스", "삼성패스", "KB모바일"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];
export const TELECOMS = ["SKT", "KT", "LG U+"] as const;
export const CONSENT_WAYS = ["통화", "대면", "문자"] as const;

// 4대보험 가입자명부는 CODEF 에서 공동인증서만(간편인증 불가) → 제외. 사업자등록증명은 DB 연결에 쓰므로 항상 받는다.
export type DocKey = "biz" | "vat" | "fs" | "tax" | "income";
export const DOCS: { key: DocKey; label: string; note?: string; locked?: boolean }[] = [
  { key: "biz", label: "사업자등록증명", note: "모든 사업장 · DB 연결에 필요", locked: true },
  { key: "vat", label: "부가세 과세표준증명", note: "최근 3년" },
  { key: "fs", label: "표준재무제표증명", note: "당기 포함 3개년 · 08~22시" },
  { key: "tax", label: "납세증명(국세 완납)" },
  { key: "income", label: "소득금액증명", note: "개인사업자" },
];
export const DEFAULT_DOCS: DocKey[] = ["biz", "vat", "fs"];
export const docLabel = (k: DocKey) => DOCS.find(d => d.key === k)?.label ?? k;

export type DocResult = { key: DocKey; ok: boolean; reason?: string; issuedAt?: string; facts: string[] };

/** DB 관리시트의 업체 한 줄(합성). 실제는 DB 정본(Postgres)에서 내 DB만. */
export type DbRow = { id: string; name: string; bizNo: string; owner: string; phone: string; channel: string };
export const DB_ROWS: DbRow[] = [
  { id: "db-1", name: "주식회사 서해바다수산물유통가공영농조합법인 제2공장", bizNo: "312-81-55210", owner: "남궁민수", phone: "010-9934-1207", channel: "매입DB" },
  { id: "db-2", name: "대성철강", bizNo: "", owner: "박준호", phone: "010-3320-4471", channel: "현수막" },
  { id: "db-3", name: "(주)대성철강산업", bizNo: "", owner: "박성진", phone: "010-7781-2290", channel: "소개" },
  { id: "db-4", name: "그린카페", bizNo: "", owner: "이서연", phone: "010-5512-8890", channel: "블로그" },
];

export type Candidate = { id: string; why: string };
/** 서류 도착 뒤 사업자별 DB 연결 상태. auto=확실히 일치 · pick=후보 확인 필요 · none=없음 · linked=수강생이 고름 · added=새 DB · later=나중에. */
export type Link =
  | { state: "auto" | "linked"; dbId: string; why: string }
  | { state: "pick"; candidates: Candidate[] }
  | { state: "none" | "added" | "later" };

/**
 * 사업자 하나를 DB 에 맞춘다. ① 사업자번호 일치 → 자동 ② 대표 휴대폰 일치 + 비슷한 상호 → 자동
 * ③ 휴대폰만 일치 또는 상호만 비슷 → 후보(수강생 확인) ④ 없음.
 */
export function matchDb(biz: { name: string; bizNo: string }, phone: string): Link {
  const byNo = DB_ROWS.find(r => r.bizNo && r.bizNo === biz.bizNo);
  if (byNo) return { state: "auto", dbId: byNo.id, why: "사업자번호 일치" };
  const samePhone = DB_ROWS.filter(r => r.phone === phone);
  const both = samePhone.find(r => isSimilarDbSheetCompany(r.name, biz.name));
  if (both) return { state: "auto", dbId: both.id, why: "대표 휴대폰·상호 일치" };
  const cands: Candidate[] = [
    ...samePhone.map(r => ({ id: r.id, why: "같은 대표 휴대폰" })),
    ...DB_ROWS.filter(r => !samePhone.includes(r) && isSimilarDbSheetCompany(r.name, biz.name)).map(r => ({ id: r.id, why: "비슷한 상호" })),
  ];
  return cands.length ? { state: "pick", candidates: cands } : { state: "none" };
}
export const dbRow = (id: string) => DB_ROWS.find(r => r.id === id);

/** 한 대표 아래 사업자 하나 — 서류와 DB 연결을 따로 갖는다. */
export type Biz = { name: string; bizNo: string; results: DocResult[]; link: Link };

export type ReqStatus = "waiting" | "scraping" | "done" | "expired" | "canceled";
export type AuthRequest = {
  id: string;
  owner: string; // 화면에는 가린 이름만
  phone: string; // 가린 번호만(화면)
  phoneKey: string; // 매칭용 — 실제 구현은 서버에서만 비교, 화면에 내리지 않는다
  method: AuthMethod;
  docs: DocKey[];
  status: ReqStatus;
  sentAt: string;
  deadline: number;
  resends: number;
  progress: number; // 받은 서류 종류 수(받는 중 표시)
  businesses: Biz[];
};

export const WAIT_LIMIT_MS = 270_000; // CODEF 간편인증 대기 4분 30초

export const maskName = (n: string) => (n.length <= 1 ? n : n.length === 2 ? `${n[0]}*` : `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`);
export const maskPhone = (p: string) => p.replace(/^(\d{3})-?(\d{3,4})-?(\d{4})$/, "$1-****-$3");

const FACTS: Record<DocKey, string[]> = {
  biz: ["개업일 2019-03-11 · 계속사업자", "업태 제조업 · 종목 금속가공"],
  vat: ["2025년 과세표준 1,284,500,000원", "2024년 1,012,300,000원 · 2023년 884,000,000원"],
  fs: ["2025년 매출액 1,301,000,000원 · 영업이익 96,400,000원", "2024년 매출액 1,020,000,000원 · 2023년 890,000,000원"],
  tax: ["국세 체납 없음"],
  income: ["2025년 사업소득 84,200,000원"],
};
export function resultFor(key: DocKey, fail = false): DocResult {
  if (fail) return { key, ok: false, reason: key === "fs" ? "2025년분이 아직 신고되지 않았어요. 2023·2024년분만 받았어요." : "홈택스가 잠시 응답하지 않았어요.", facts: [] };
  return { key, ok: true, issuedAt: "2026-11-08", facts: FACTS[key] };
}
export function makeBiz(b: { name: string; bizNo: string }, docs: DocKey[], phone: string, failKey?: DocKey): Biz {
  return { ...b, results: docs.map(k => resultFor(k, k === failKey)), link: matchDb(b, phone) };
}
/** 새로 보낸 요청에서 올 사업자들(합성) — 둘 다 DB 에 없어 「새 DB로 추가」 흐름을 보여 준다. */
export const NEW_BIZES = [{ name: "한빛정밀", bizNo: "214-08-77123" }, { name: "한빛물산", bizNo: "214-12-90311" }];

/** 업체정보 칸에 반영할 수 있는 값(합성). */
export const PROPOSAL: { key: CompanyInfoKey; value: string; source: DocKey }[] = [
  { key: "개업일", value: "2019-03-11", source: "biz" },
  { key: "업태", value: "제조업", source: "biz" },
  { key: "과년도매출", value: "1284.5", source: "vat" },
  { key: "과년도매출Y2", value: "1012.3", source: "vat" },
  { key: "영업이익", value: "96.4", source: "fs" },
  { key: "자산총계", value: "2050", source: "fs" },
];
export const FIELD_LABEL: Record<string, string> = { 개업일: "개업일", 업태: "업태", 과년도매출: "2025년 매출", 과년도매출Y2: "2024년 매출", 영업이익: "영업이익", 자산총계: "자산총계" };
export const CURRENT_INFO = { 개업일: "2019-03-11", 업태: "", 과년도매출: "1200", 과년도매출Y2: "", 영업이익: "", 자산총계: "" };

let seq = 100;
export const nextId = () => `req-${++seq}`;

/** 처음 열었을 때 보이는 예시 목록(합성). */
export function seedRequests(now: number): AuthRequest[] {
  const all = DEFAULT_DOCS;
  const base = { sentAt: "", deadline: 0, resends: 0, progress: 0, businesses: [] as Biz[] };
  const seohaePhone = "010-9934-1207", parkPhone = "010-3320-4471";
  return [
    { ...base, id: "req-1", owner: maskName("김도윤"), phone: maskPhone("010-2481-5678"), phoneKey: "010-2481-5678", method: "카카오톡", docs: [...all, "income"], status: "waiting", sentAt: "11-08 14:02", deadline: now + 192_000 },
    { ...base, id: "req-2", owner: maskName("남궁민수"), phone: maskPhone(seohaePhone), phoneKey: seohaePhone, method: "네이버", docs: all, status: "done", sentAt: "11-08 11:40", progress: all.length,
      businesses: [makeBiz({ name: "주식회사 서해바다수산물유통가공영농조합법인 제2공장", bizNo: "312-81-55210" }, all, seohaePhone, "fs")] },
    { ...base, id: "req-3", owner: maskName("이서연"), phone: maskPhone("010-5512-8890"), phoneKey: "010-5512-8890", method: "PASS", docs: ["biz", "vat"], status: "expired", sentAt: "11-07 17:15", resends: 1 },
    { ...base, id: "req-4", owner: maskName("박준호"), phone: maskPhone(parkPhone), phoneKey: parkPhone, method: "토스", docs: all, status: "done", sentAt: "11-07 10:05", progress: all.length,
      businesses: [makeBiz({ name: "대성철강", bizNo: "607-12-33410" }, all, parkPhone), makeBiz({ name: "대성정밀가공", bizNo: "607-25-81002" }, all, parkPhone)] },
  ];
}
