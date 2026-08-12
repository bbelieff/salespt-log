// backfill-sheet-rows-legacy.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (backfill-db-row-numbers.d.mts 와 같은 관례).
export const LEGACY_CONTRACT_TAB: string;
export const LEGACY_CONTRACT_FIRST_DATA_ROW: number;
export const LEGACY_DB_SECTIONS: ReadonlyArray<{
  name: string;
  c1: string;
  c2: string;
  rowStart: number;
  rowMax: number;
}>;
export function isLegacyDbSectionTotalRow(firstCellText: unknown): boolean;
export const LEGACY_SALES_CHANNELS: readonly string[];
export const LEGACY_SALES_WEEK_STRIDE: number;
export const LEGACY_SALES_FIRST_ROW: number;
export function legacySalesBlockRow(w: number, d: number, c: number): number;
