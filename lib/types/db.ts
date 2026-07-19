/**
 * Layer: types — 03 DB관리 raw log 모델(매입/생산/현수막/발굴). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: sheet-structure.md §5 · data-model.md.
 */
import { z } from "zod";

// DB관리 raw log(시트매핑 sheet-structure.md §5). 부가세여부=입력 부가세 포함 플래그(저장은 항상 ex-VAT, ADR-0021). 주문금액·개당단가=계산값(미저장).
export const DBPurchase = z.object({
  row: z.number().int().min(2).optional(),
  구매일: z.string().default(""),
  업체명: z.string().default(""),
  개당단가: z.number().nonnegative().default(0),
  주문개수: z.number().int().nonnegative().default(0),
  주문금액: z.number().nonnegative().optional(), // 계산값(개당단가×개수)
  기타: z.string().default(""),
  부가세여부: z.boolean().default(false), // F열
});
export type DBPurchase = z.infer<typeof DBPurchase>;

export const DBProduction = z.object({
  row: z.number().int().min(2).optional(),
  시작일: z.string().default(""), // I열 (생산 시작)
  종료일: z.string().default(""), // J열 (생산 종료 = 집계 기준일)
  소재: z.string().default(""),
  기간예산: z.number().nonnegative().default(0), // L열 (부가세 제외 저장)
  생산개수: z.number().int().nonnegative().default(0), // M열 (빈/0=생산중)
  개당단가: z.number().nonnegative().optional(), // 계산값(예산÷개수, 미저장)
  기타: z.string().default(""),
  부가세여부: z.boolean().default(false), // N열
});
export type DBProduction = z.infer<typeof DBProduction>;

export const DBBanner = z.object({
  row: z.number().int().min(2).optional(),
  날짜: z.string().default(""),
  업체명: z.string().default(""),
  도착일: z.string().default(""),
  개당단가: z.number().nonnegative().default(0),
  주문개수: z.number().int().nonnegative().default(0),
  주문금액: z.number().nonnegative().optional(), // 계산값(개당단가×개수)
  기타: z.string().default(""),
  부가세여부: z.boolean().default(false), // U열
});
export type DBBanner = z.infer<typeof DBBanner>;
// (현수막 게시로그 1:N AF:AI — ADR-0023 폐기, ADR-0025: 게시=생산은 컨택 E 소유.)

export const DBLead = z.object({
  row: z.number().int().min(2).optional(),
  구분: z.string().default(""), // 콜드콜/지인/기고객/소개 (자유입력)
  접수일: z.string().default(""),
  대표자명: z.string().default(""),
  업체명: z.string().default(""),
  소개처: z.string().default(""),
  연락처: z.string().default(""),
  조건: z.string().default(""),
  발굴id: z.string().optional(), // 발굴 링크(DB payload 전용·시트 컬럼 0). optional 고정=R11(default 금지). lead-chain §4-3
});
export type DBLead = z.infer<typeof DBLead>;
