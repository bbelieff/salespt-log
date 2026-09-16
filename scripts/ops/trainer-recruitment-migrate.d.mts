export const VERSION: string;
export const EXPECTED_CHECKSUM: string;
export function preflight(client: unknown, files: unknown[]): Promise<any>;
export function executeExact(client: unknown, files: unknown[]): Promise<any>;
export function parseArgs(args: string[]): {execute:boolean};
export function pinnedMigration(files: unknown[]): unknown;
