// parity-classify.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (backfill-db-row-numbers.d.mts 와 같은 관례 — 테스트가 import 하는 이 스크립트 하나만 타입을 선언한다).

export interface ClassifyDiffInput {
  field: string;
  sheetValue: unknown;
  dbValue: unknown;
}

export interface ClassifyAlternate {
  name: string;
  recompute: (rows: Record<string, unknown>[]) => unknown;
}

export interface ClassifyContext {
  contributingDbRows?: Record<string, unknown>[];
  alternates?: ClassifyAlternate[];
  sheetRowRecount?: unknown;
}

export interface ClassifyResult {
  type: string;
  detail: string;
}

export interface ClassifiedItem {
  user: string;
  field: string;
  sheetValue: unknown;
  dbValue: unknown;
  type: string;
  detail: string;
}

export interface SummarizedClassification {
  counts: Record<string, number>;
  real: ClassifiedItem[];
  text: string;
}

export function looksLikeUnrenderedSerial(v: unknown): boolean;
export function serialToISO(v: unknown): string | null;
export function classifyDiff(d: ClassifyDiffInput, ctx?: ClassifyContext): ClassifyResult;
export function summarizeClassification(items: ClassifiedItem[]): SummarizedClassification;
