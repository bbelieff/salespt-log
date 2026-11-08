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

// 4대보험 가입자명부는 CODEF 에서 공동인증서만(간편인증 불가) → 제외. 사업자등록증명은 DB 연결에 쓰므로 항상 받는다.
// 지방세 완납증명(정부24, belie 2026-11-08): 기관이 달라 고객 승인 1번 더, 주민번호·주소 필요(CODEF 문서).
export type DocKey = "biz" | "vat" | "fs" | "tax" | "localTax" | "income";
export const DOCS: { key: DocKey; label: string; note?: string; locked?: boolean; gov24?: boolean }[] = [
  { key: "biz", label: "사업자등록증명", note: "필수", locked: true },
  { key: "vat", label: "부가세 과세표준증명", note: "3년" },
  { key: "fs", label: "표준재무제표증명", note: "3년" },
  { key: "tax", label: "국세 완납증명" },
  { key: "localTax", label: "지방세 완납증명", note: "정부24 · 승인 1번 더", gov24: true },
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
/**
 * 서류 도착 뒤 사업자별 DB 연결 상태(belie 2026-11-08).
 * auto=기존 DB 와 일치 · linked=수강생이 고름 · pick=상호만 비슷해 확인 필요 ·
 * created=새 DB 를 만듦(extra=같은 대표의 추가 DB 줄 — 대표 이름·휴대폰은 같고 사업자 정보만 다름) · later=나중에.
 */
export type Link =
  | { state: "auto" | "linked"; dbId: string; why: string }
  | { state: "pick"; candidates: Candidate[] }
  | { state: "created"; extra: boolean; sameOwnerAs: string }
  | { state: "later" };

type Match = { kind: "db"; dbId: string; why: string } | { kind: "pick"; candidates: Candidate[] } | { kind: "new"; ownerDb?: string };
/**
 * 사업자 하나를 DB 에 맞춘다. ① 사업자번호 일치 → 그 DB ② 대표 휴대폰 + 비슷한 상호 → 그 DB
 * ③ 상호만 비슷(대표 다름) → 수강생 확인 ④ 그 외 → 새 DB(같은 대표의 DB 가 이미 있으면 추가 DB 줄).
 */
function matchOne(biz: { name: string; bizNo: string }, phone: string): Match {
  const byNo = DB_ROWS.find(r => r.bizNo && r.bizNo === biz.bizNo);
  if (byNo) return { kind: "db", dbId: byNo.id, why: "사업자번호 일치" };
  const samePhone = DB_ROWS.filter(r => r.phone === phone);
  const both = samePhone.find(r => isSimilarDbSheetCompany(r.name, biz.name));
  if (both) return { kind: "db", dbId: both.id, why: "대표 휴대폰·상호 일치" };
  const similar = DB_ROWS.filter(r => !samePhone.includes(r) && isSimilarDbSheetCompany(r.name, biz.name));
  if (similar.length) return { kind: "pick", candidates: similar.map(r => ({ id: r.id, why: "비슷한 상호" })) };
  return { kind: "new", ownerDb: samePhone[0]?.id };
}

/**
 * 한 대표의 사업자들을 차례로 연결한다. 새로 만드는 DB 중 첫 사업자는 새 DB, 그다음부터는 추가 DB 줄
 * (같은 대표의 DB 가 이미 있으면 첫 사업자부터 추가 줄). 사업자별로 진행건이 나뉘게 하려는 것.
 */
export function linkBusinesses(bizes: { name: string; bizNo: string }[], phone: string): Link[] {
  let ownerName = "";
  return bizes.map(b => {
    const m = matchOne(b, phone);
    if (m.kind === "db") { ownerName ||= dbRow(m.dbId)?.name ?? ""; return { state: "auto", dbId: m.dbId, why: m.why }; }
    if (m.kind === "pick") return { state: "pick", candidates: m.candidates };
    const base = ownerName || (m.ownerDb ? dbRow(m.ownerDb)?.name ?? "" : "");
    if (!ownerName) ownerName = base || b.name;
    return { state: "created", extra: !!base, sameOwnerAs: base };
  });
}
export const dbRow = (id: string) => DB_ROWS.find(r => r.id === id);

/** 한 대표 아래 사업자 하나 — 서류와 DB 연결을 따로 갖는다. */
export type Biz = { name: string; bizNo: string; results: DocResult[]; link: Link; applied?: boolean };
/** DB 연결 + 업체정보 반영까지 끝난 사업자는 목록에서 뺀다(belie 2026-11-08). */
export const isFinished = (b: Biz) => !!b.applied && b.link.state !== "pick" && b.link.state !== "later";

export type ReqStatus = "waiting" | "scraping" | "done" | "expired" | "canceled";
export type AuthRequest = {
  id: string;
  owner: string;
  phone: string; // 마스킹 없이 그대로 보여 준다(belie 2026-11-08)
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


const FACTS: Record<DocKey, string[]> = {
  biz: ["개업일 2019-03-11 · 계속사업자", "업태 제조업 · 종목 금속가공"],
  vat: ["2025년 과세표준 1,284,500,000원", "2024년 1,012,300,000원 · 2023년 884,000,000원"],
  fs: ["2025년 매출액 1,301,000,000원 · 영업이익 96,400,000원", "2024년 매출액 1,020,000,000원 · 2023년 890,000,000원"],
  tax: ["국세 체납 없음"],
  localTax: ["지방세 체납 없음 · 유효기간 2026-12-08"],
  income: ["2025년 사업소득 84,200,000원"],
};
export function resultFor(key: DocKey, fail = false): DocResult {
  if (fail) return { key, ok: false, reason: key === "fs" ? "2025년분이 아직 신고되지 않았어요. 2023·2024년분만 받았어요." : "홈택스가 잠시 응답하지 않았어요.", facts: [] };
  return { key, ok: true, issuedAt: "2026-11-08", facts: FACTS[key] };
}
/** 한 대표의 사업자들 → 서류 + DB 연결(새 DB/추가 DB 줄 자동 생성 포함). */
export function makeBizes(list: { name: string; bizNo: string }[], docs: DocKey[], phone: string, failKey?: DocKey): Biz[] {
  const links = linkBusinesses(list, phone);
  return list.map((b, i) => ({ ...b, results: docs.map(k => resultFor(k, k === failKey)), link: links[i] ?? { state: "later" } }));
}
/** 새로 보낸 요청에서 올 사업자들(합성) — DB 에 없어 첫째는 새 DB, 둘째는 추가 DB 줄로 만들어진다. */
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
    { ...base, id: "req-1", owner: "김도윤", phone: "010-2481-5678", method: "카카오톡", docs: [...all, "income"], status: "waiting", sentAt: "11-08 14:02", deadline: now + 192_000 },
    { ...base, id: "req-2", owner: "남궁민수", phone: seohaePhone, method: "네이버", docs: all, status: "done", sentAt: "11-08 11:40", progress: all.length,
      businesses: makeBizes([{ name: "주식회사 서해바다수산물유통가공영농조합법인 제2공장", bizNo: "312-81-55210" }], all, seohaePhone, "fs") },
    { ...base, id: "req-3", owner: "이서연", phone: "010-5512-8890", method: "PASS", docs: ["biz", "vat"], status: "expired", sentAt: "11-07 17:15", resends: 1 },
    { ...base, id: "req-4", owner: "박준호", phone: parkPhone, method: "토스", docs: all, status: "done", sentAt: "11-07 10:05", progress: all.length,
      businesses: makeBizes([{ name: "대성철강", bizNo: "607-12-33410" }, { name: "대성정밀가공", bizNo: "607-25-81002" }], all, parkPhone) },
    { ...base, id: "req-5", owner: "박준호", phone: parkPhone, method: "토스", docs: ["biz"], status: "canceled", sentAt: "11-07 09:58" },
    { ...base, id: "req-6", owner: "최유진", phone: "010-4410-7723", method: "네이버", docs: all, status: "done", sentAt: "11-06 16:20", progress: all.length,
      businesses: makeBizes([{ name: "유진플라워", bizNo: "105-33-20871" }], all, "010-4410-7723") },
    { ...base, id: "req-7", owner: "정하늘", phone: "010-6620-3391", method: "카카오톡", docs: all, status: "expired", sentAt: "11-06 11:02" },
  ];
}
