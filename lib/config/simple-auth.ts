/**
 * Layer: config. 간편인증 서류 조회 고정값 — 서류 목록·CODEF 상품 경로·간편인증 앱 코드·대기 한도.
 * 근거: developer.codef.io 상품 페이지(2026-11-09 열람)·데모 실측(2026-11-08), 계획 docs/plans/active/simple-auth-scraping.md.
 */
import type { SimpleAuthDocKey, SimpleAuthMethod } from "@/types/simple-auth";

export const SIMPLE_AUTH_SITES = ["홈택스", "정부24", "4대사회보험 정보연계센터"] as const;
export type SimpleAuthSite = (typeof SIMPLE_AUTH_SITES)[number];

export type SimpleAuthDocDef = {
  key: SimpleAuthDocKey;
  label: string;
  short: string;
  note?: string;
  /** 발급 기관 — 화면에서 기관별로 묶어 보여 준다. */
  site: SimpleAuthSite;
  locked?: boolean;
  /** 공동인증서로만 받을 수 있다. */
  certOnly?: boolean;
  /** 간편인증 탭에만 보인다. */
  simpleOnly?: boolean;
};

export const SIMPLE_AUTH_DOCS: readonly SimpleAuthDocDef[] = [
  { key: "biz", label: "사업자등록증명", short: "사업자등록", note: "필수", site: "홈택스", locked: true },
  { key: "vat", label: "부가세 과세표준증명", short: "부가세", note: "3년", site: "홈택스" },
  { key: "fs", label: "표준재무제표증명", short: "재무제표", note: "3년", site: "홈택스" },
  { key: "tax", label: "국세 완납증명", short: "국세", site: "홈택스" },
  { key: "income", label: "소득금액증명", short: "소득금액", note: "개인사업자", site: "홈택스", simpleOnly: true },
  { key: "localTax", label: "지방세 완납증명", short: "지방세", site: "정부24" },
  { key: "ins", label: "4대보험 가입자명부", short: "4대보험", site: "4대사회보험 정보연계센터", certOnly: true },
];
export const SIMPLE_AUTH_DEFAULT_DOCS: readonly SimpleAuthDocKey[] = ["biz", "vat", "fs"];
/** 공동인증서 탭 기본 — 법인·개인 같은 6종(belie 2026-11-09). */
export const SIMPLE_AUTH_CERT_DEFAULT_DOCS: readonly SimpleAuthDocKey[] = ["biz", "vat", "fs", "tax", "localTax", "ins"];

export const simpleAuthDocLabel = (k: SimpleAuthDocKey) => SIMPLE_AUTH_DOCS.find((d) => d.key === k)?.label ?? k;
export const simpleAuthDocShort = (k: SimpleAuthDocKey) => SIMPLE_AUTH_DOCS.find((d) => d.key === k)?.short ?? k;

export const SIMPLE_AUTH_APPS = ["카카오톡", "네이버", "PASS", "토스", "삼성패스", "KB모바일"] as const satisfies readonly SimpleAuthMethod[];
export const SIMPLE_AUTH_TELECOMS = ["SKT", "KT", "LG U+", "알뜰폰 SKT", "알뜰폰 KT", "알뜰폰 LG U+"] as const;

/** CODEF loginTypeLevel — 홈택스(1 카카오 3 삼성패스 4 KB 5 PASS 6 네이버 8 토스). 정부24도 이 6개는 같은 값. */
export const CODEF_LOGIN_LEVEL: Readonly<Record<Exclude<SimpleAuthMethod, "공동인증서">, string>> = {
  카카오톡: "1", 삼성패스: "3", KB모바일: "4", PASS: "5", 네이버: "6", 토스: "8",
};
/** PASS 통신사 — 알뜰폰은 망 통신사 값(0 SKT · 1 KT · 2 LG U+). */
export const CODEF_TELECOM: Readonly<Record<string, string>> = {
  SKT: "0", KT: "1", "LG U+": "2", "알뜰폰 SKT": "0", "알뜰폰 KT": "1", "알뜰폰 LG U+": "2",
};

/** CODEF 상품 경로(호스트 뒤). 법인 지방세는 별도 상품. */
export const CODEF_PATH = {
  biz: "/v1/kr/public/nt/proof-issue/corporate-registration",
  vat: "/v1/kr/public/nt/proof-issue/additional-tax-standard",
  fs: "/v1/kr/public/nt/proof-issue/standard-financial-statements",
  tax: "/v1/kr/public/nt/proof-issue/tax-cert-all",
  income: "/v1/kr/public/nt/proof-issue/proof-income",
  localTax: "/v1/kr/public/mw/localtax-payment-certificate/inquiry",
  localTaxCorp: "/v1/kr/public/mw/corporation-localtax-payment-certificate/inquiry",
  ins: "/v1/kr/public/pp/4insure/business-establishment-subscribers",
} as const;

/** CODEF 간편인증 승인 대기 4분 30초(문서·실측). */
export const SIMPLE_AUTH_WAIT_MS = 270_000;
/** 「승인 확인」은 CODEF 가 3번째 미승인에서 끊으므로 2번까지만 보낸다. */
export const SIMPLE_AUTH_CONFIRM_TRIES = 2;
/** 하루에 보낼 수 있는 요청 수(수강생 1명). 데모 키는 계정 전체 하루 100건. */
export const SIMPLE_AUTH_DAILY_LIMIT = 20;
/** 결과 보관 기간(일). 지나면 목록·원문에서 지운다. */
export const SIMPLE_AUTH_KEEP_DAYS = 90;
/** 부가세·재무제표 조회 연수. */
export const SIMPLE_AUTH_YEARS = 3;
