/**
 * Layer: types. 간편인증 서류 조회(docs/plans/active/simple-auth-scraping.md, belie 2026-11-09).
 * 수강생이 고객(업체 대표)에게 간편인증을 보내거나 고객 공동인증서로 홈택스·정부24·4대보험 증명을 받아
 * 사업자별로 나눠 저장하고, 수강생 DB 에 연결한 뒤 업체정보에 반영한다.
 */
import { z } from "zod";

/** 받을 서류. biz 사업자등록증명 · vat 부가세 과세표준증명 · fs 표준재무제표증명 · tax 국세 납세증명 · localTax 지방세 납세증명 · ins 4대보험 가입자명부 · income 소득금액증명 · closed 폐업사실증명. */
export const SimpleAuthDocKey = z.enum(["biz", "vat", "fs", "tax", "localTax", "ins", "income", "closed"]);
export type SimpleAuthDocKey = z.infer<typeof SimpleAuthDocKey>;

/** 간편인증 앱. 공동인증서는 별도 수단. */
export const SimpleAuthMethod = z.enum(["카카오톡", "네이버", "PASS", "토스", "삼성패스", "KB모바일", "공동인증서"]);
export type SimpleAuthMethod = z.infer<typeof SimpleAuthMethod>;

export const SimpleAuthStatus = z.enum(["waiting", "scraping", "done", "expired", "canceled", "failed"]);
export type SimpleAuthStatus = z.infer<typeof SimpleAuthStatus>;

/** 업체정보 칸 후보 하나(문서 자동입력 비교표에 그대로 넘긴다). sourceWon = 원 단위 원문 금액. */
export const SimpleAuthField = z.object({ key: z.string(), value: z.string(), confidence: z.number(), sourceWon: z.number().optional() });
export type SimpleAuthField = z.infer<typeof SimpleAuthField>;

/** 서류 한 종류의 결과. facts = 화면에 보일 요약 줄, hasOriginal = 원문 PDF 저장 여부. */
export const SimpleAuthDocResult = z.object({
  key: SimpleAuthDocKey,
  ok: z.boolean(),
  reason: z.string().optional(),
  issuedAt: z.string().optional(),
  facts: z.array(z.string()),
  fields: z.array(SimpleAuthField).default([]),
  hasOriginal: z.boolean().default(false),
});
export type SimpleAuthDocResult = z.infer<typeof SimpleAuthDocResult>;

/** 사업자 ↔ 수강생 DB 연결 상태. pick = 후보가 여럿이라 수강생이 골라야 함. */
export const SimpleAuthLink = z.discriminatedUnion("state", [
  z.object({ state: z.literal("linked"), dbId: z.string(), company: z.string(), why: z.enum(["bizNo", "phone", "picked", "created"]) }),
  z.object({ state: z.literal("pick"), candidates: z.array(z.object({ dbId: z.string(), company: z.string(), owner: z.string(), phone: z.string() })) }),
  z.object({ state: z.literal("none") }),
  z.object({ state: z.literal("later") }),
]);
export type SimpleAuthLink = z.infer<typeof SimpleAuthLink>;

export const SimpleAuthBusiness = z.object({
  bizNo: z.string(),
  name: z.string(),
  results: z.array(SimpleAuthDocResult),
  link: SimpleAuthLink,
  applied: z.boolean().default(false),
});
export type SimpleAuthBusiness = z.infer<typeof SimpleAuthBusiness>;

export const SimpleAuthRequest = z.object({
  id: z.string().uuid(),
  owner: z.string(),
  phone: z.string(),
  method: SimpleAuthMethod,
  docs: z.array(SimpleAuthDocKey),
  status: SimpleAuthStatus,
  sentAt: z.string(),
  deadline: z.number(),
  resends: z.number().int(),
  progress: z.number().int(),
  error: z.string().optional(),
  businesses: z.array(SimpleAuthBusiness),
});
export type SimpleAuthRequest = z.infer<typeof SimpleAuthRequest>;

/** 지방세 납세증명용 주소(도로명주소 검색 결과). road = 「세종대로 110」, detail = 동·호수. */
export const SimpleAuthAddress = z.object({ road: z.string().min(2).max(100), detail: z.string().max(100).default(""), full: z.string().max(200).default("") });
export type SimpleAuthAddress = z.infer<typeof SimpleAuthAddress>;

const phone = z.string().regex(/^010-\d{4}-\d{4}$/);
/** 재무제표를 사업장별로 받을 사업자번호(선택) — 사업장이 여러 곳이면 홈택스가 번호 없이는 내주지 않는다. */
const bizNos = z.array(z.string().regex(/^\d{3}-?\d{2}-?\d{5}$/)).max(5).default([]);
/** 간편인증 보내기. 주민번호 뒷자리는 지방세를 고를 때만 받고 저장하지 않는다. */
export const SimpleAuthStartSimple = z.object({
  mode: z.literal("simple"),
  owner: z.string().trim().min(1).max(30),
  birth: z.string().regex(/^\d{8}$/),
  phone,
  telecom: z.enum(["", "SKT", "KT", "LG U+", "알뜰폰 SKT", "알뜰폰 KT", "알뜰폰 LG U+"]).default(""),
  method: SimpleAuthMethod.exclude(["공동인증서"]),
  docs: z.array(SimpleAuthDocKey.exclude(["ins"])).min(1),
  rrnBack: z.string().regex(/^\d{7}$/).optional(),
  address: SimpleAuthAddress.optional(),
  bizNos,
});
/** 공동인증서로 가져오기. 인증서·비밀번호는 요청에만 쓰고 저장하지 않는다. */
export const SimpleAuthStartCert = z.object({
  mode: z.literal("cert"),
  owner: z.string().trim().min(1).max(30),
  phone: z.union([phone, z.literal("")]).default(""),
  certPfx: z.string().min(100).max(40_000).optional(),
  certDer: z.string().min(100).max(40_000).optional(),
  certKey: z.string().min(100).max(40_000).optional(),
  certPassword: z.string().min(1).max(100),
  docs: z.array(SimpleAuthDocKey.exclude(["income"])).min(1),
  address: SimpleAuthAddress.optional(),
  bizNos,
});
export const SimpleAuthStart = z.discriminatedUnion("mode", [SimpleAuthStartSimple, SimpleAuthStartCert]);
export type SimpleAuthStart = z.infer<typeof SimpleAuthStart>;

/** 요청 한 건에 대한 동작. */
export const SimpleAuthAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("resend") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("link"), bizNo: z.string(), link: z.discriminatedUnion("to", [
    z.object({ to: z.literal("db"), dbId: z.string() }),
    z.object({ to: z.literal("new") }),
    z.object({ to: z.literal("later") }),
  ]) }),
  z.object({ action: z.literal("apply"), bizNo: z.string(), patch: z.record(z.string(), z.string()) }),
]);
export type SimpleAuthAction = z.infer<typeof SimpleAuthAction>;
