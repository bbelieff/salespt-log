// registry-parity-lib.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (backfill-db-row-numbers.d.mts 와 같은 관례).

export interface FieldMismatch {
  key: string;
  field: string;
  sheet: unknown;
  db: unknown;
}

export interface DiffByKeyResult {
  uniqueSheetKeys: number;
  dbCount: number;
  missingInDb: string[];
  missingInSheet: string[];
  fieldMismatches: FieldMismatch[];
}

export interface ClassifiedItem {
  user: string;
  field: string;
  sheetValue: unknown;
  dbValue: unknown;
  type: string;
  detail: string;
}

export function diffByKey(
  sheetRows: Record<string, unknown>[],
  dbRows: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => string,
  fields: string[],
  normalizers?: Record<string, (raw: unknown) => string>,
): DiffByKeyResult;

export function classifyFieldMismatches(mismatches: FieldMismatch[], label: string): ClassifiedItem[];
export function missingInDbAsClassified(keys: string[], label: string): ClassifiedItem[];
export function normalizeSortOrder(raw: unknown): string;
export function normalizeCohortType(raw: unknown): string;
