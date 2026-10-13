export function headerVerdict(cell: unknown, expectedKey?: string): "ok" | "blocked";
export function inspectColumn(values?: unknown[][]): { headerBlocked: boolean; filledCells: number };
export function censusBlocked(totals: Array<{ filledCells: number; headerBlocked: number }>, errors: number, targetCount: number): boolean;
