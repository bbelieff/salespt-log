// scoreboard-parity-lib.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (backfill-db-row-numbers.d.mts 와 같은 관례).

export interface NormalizedMeeting {
  상태: string;
  channel?: string;
  미팅날짜: string;
  구분: string;
  _raw미팅날짜?: unknown;
}

export interface WeekRow {
  week: number;
  생산: number;
  유입: number;
  컨택: number;
  미팅: number;
  계약: number;
}

export interface WeeklyPerf {
  weeks: WeekRow[];
  contrib: Map<string, Record<string, unknown>[]>;
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

export function num(v: unknown): number;
export function parseISO(s: string): Date;
export function serialToISO(v: unknown): string | null;
export function weekIndexOf(date: Date, cs: Date): number;

export function computeWeeklyPerf(
  meetings: NormalizedMeeting[],
  sales: Record<string, unknown>[],
  courseStart: Date,
): WeeklyPerf;

export function diffWeekly(sheetWeeks: WeekRow[], dbWeeks: WeekRow[]): DiffItem[];
export function isMeetingField(f: string): boolean;
export function lookupWeekField(weeks: WeekRow[], field: string): unknown;
export function buildAlternates(field: string): Alternate[];
export function normalizeDbMeeting(p: Record<string, unknown>): NormalizedMeeting;
export function normalizeSheetMeetingRow(r: unknown[]): NormalizedMeeting;
