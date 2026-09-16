type Row = {keyHash: string; cohort: string; region: string};
export function applyTrainingRegions(client: { query(sql: string, params?: unknown[]): Promise<{rows: Record<string, unknown>[]; rowCount?: number | null}> }, rows: Row[], execute?: boolean): Promise<{mode: string; checked: number; blank: number; already: number; changed: number}>;
