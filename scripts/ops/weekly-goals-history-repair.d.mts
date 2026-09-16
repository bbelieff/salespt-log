import type { MigrationClient } from "./weekly-goals-migrate.mjs";
export function repairHistoryAcl(client: MigrationClient, assertRuntimeUnchanged: () => Promise<void>): Promise<Record<string, unknown>>;
