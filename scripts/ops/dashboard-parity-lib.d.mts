// dashboard-parity-lib.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (backfill-db-row-numbers.d.mts 와 같은 관례).

export interface NormalizedMeeting {
  상태: string;
  channel: string;
  미팅날짜: string;
  계약여부: boolean;
  구분: string;
  _raw미팅날짜?: unknown;
}

export interface NormalizedContract {
  수임비: number;
  구분: string;
  계약일: string;
  _raw계약일?: unknown;
}

export interface NormalizedSales {
  date: string;
  channel: string;
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation?: number;
}

export interface ChannelMatrixRow {
  채널: string;
  생산: number;
  유입: number;
  컨택진행: number;
  미팅예약: number;
  미팅완료: number;
  계약: number;
}

export interface Aggregates {
  channelMatrix: ChannelMatrixRow[];
  weeklyContracts: number[];
  weeklyActivity: number[];
  누적수임비: number;
  contrib: Map<string, Record<string, unknown>[]>;
}

export interface SheetFormulaValues {
  courseStart: string | null;
  channelMatrix: ChannelMatrixRow[];
  weeklyContracts: number[];
  weeklyActivity: number[];
  누적수임비: number;
}

/** diff() 가 실제로 읽는 필드만 — courseStart 는 안 씀(합성 테스트 데이터를 가볍게 만들기 위해 별도 정의). */
export interface DiffableAggregates {
  channelMatrix: ChannelMatrixRow[];
  weeklyContracts: number[];
  weeklyActivity: number[];
  누적수임비: number;
}

export interface DiffItem {
  f: string;
  s: number;
  d: number;
}

export interface Alternate {
  name: string;
  recompute: (rows: Record<string, unknown>[]) => unknown;
}

export const CHANNEL_ORDER: readonly string[];
export function num(v: unknown): number;
export function colName(i: number): string;
export function coerce(v: unknown): unknown;
export function serialToISO(v: unknown): string | null;
export function parseISO(s: string): Date;
export function weekIndexOf(date: Date, cs: Date): number;
export function fieldOrCol(p: Record<string, unknown>, field: string, colIdx: number): unknown;

export function computeAggregates(
  meetings: NormalizedMeeting[],
  sales: NormalizedSales[],
  contracts: NormalizedContract[],
  courseStart: Date,
  courseStartISO: string,
): Aggregates;

export function diff(sheet: DiffableAggregates, db: DiffableAggregates): DiffItem[];
export function isMeetingOrContractField(f: string): boolean;
export function buildAlternates(field: string): Alternate[];
export function lookupField(agg: Aggregates, field: string): unknown;

export function normalizeDbMeeting(p: Record<string, unknown>): NormalizedMeeting;
export function normalizeDbContract(p: Record<string, unknown>): NormalizedContract;
export function normalizeDbSales(p: Record<string, unknown>): NormalizedSales;
export function normalizeSheetMeetingRow(r: unknown[]): NormalizedMeeting;
export function normalizeSheetContractRow(r: unknown[]): NormalizedContract;
export function normalizeSheetSalesGrid(rows: unknown[][], courseStartISO: string): NormalizedSales[];
export interface SourceFingerprintEntry { fingerprint: string; sheetCount: number; dbCount: number; }
export function diffSourceFingerprints(
  source: "sales" | "meetings",
  sheetRows: Array<Record<string, unknown>>,
  dbRows: Array<Record<string, unknown>>,
): { onlyInSheet: SourceFingerprintEntry[]; onlyInDb: SourceFingerprintEntry[]; countMismatch: SourceFingerprintEntry[] };

export function inSheetWindow(dateISO: string | undefined, courseStart: Date): boolean;

export interface FingerprintEntry {
  계약일: string;
  수임비: number;
  구분?: string;
  sheetCount?: number;
  dbCount?: number;
  detail?: string;
}

export interface ContractFingerprintDiff {
  onlyInSheet: FingerprintEntry[];
  onlyInDb: FingerprintEntry[];
  countMismatch: FingerprintEntry[];
  typeDrift: FingerprintEntry[];
}

export function contractFingerprint(c: NormalizedContract): string;
export function contractFingerprintNoType(c: NormalizedContract): string;
export function diffContractFingerprints(
  sheetRows: NormalizedContract[],
  dbRows: NormalizedContract[],
): ContractFingerprintDiff;
