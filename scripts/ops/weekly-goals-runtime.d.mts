export function parseProcessEnv(raw: string): Record<string, string>;
export function selectPm2(list: unknown[]): number;
export function compareResolvedUrls(app: string, migration: string): { targetMatches: boolean; configuredRoleMatches: boolean };
export function compareRuntime(): Promise<{ assertUnchanged: () => Promise<void>; report: Record<string, unknown> }>;
export function resolveNextEnvironment(root: string): { combinedEnv: Record<string, string> };
export function inspectEnvironmentFiles(root: string, startedAt: number): Promise<unknown[]>;
export function assertNoPgOverrides(env: Record<string, string | undefined>): void;
export function inspectRuntimeDatabase(client: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }): Promise<Record<string, unknown>>;
