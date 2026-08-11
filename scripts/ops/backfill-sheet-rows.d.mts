export type LegacyRow = { rowKey: string; payload: Record<string, unknown>; row: number };

export function parseLegacyDbManagement(rows: unknown[][]): LegacyRow[];
export function parseLegacySalesRows(rows: unknown[][], year: number): LegacyRow[];
