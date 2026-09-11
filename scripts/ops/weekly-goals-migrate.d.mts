// Scoped declarations for the plain-JavaScript operational runner (allowJs remains false).
import type { MigrationFile } from "../db-migrate.mjs";

export const VERSION: "0005_weekly_goals.sql";
export const EXPECTED_CHECKSUM: string;
export const LOCK_KEY: 786569;
export const DATABASE_LIMITS: Readonly<{ connectionTimeoutMillis: 15000; statement_timeout: 60000;
  lock_timeout: 10000; query_timeout: 65000 }>;
/** A verified delivery manifest carries only inventory for unrelated SQL, which is never executed. */
export type MigrationInventoryFile = Omit<MigrationFile, "sql"> & { sql?: string };
export interface MigrationRuntime {
  files?: MigrationInventoryFile[];
  /** Installed application root, required to match process.cwd() for the protected env resolver. */
  appRoot?: string;
}

export interface MigrationClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export type MigrationMode = "PREFLIGHT_READ_ONLY" | "NO_OP" | "APPLIED_EXACT_ONLY";
export interface MigrationReport<Mode extends MigrationMode = MigrationMode> {
  mode: Mode;
  observedAt: string;
  version: typeof VERSION;
  checksum: string;
  historyExists: boolean;
  applied: { version: string; checksum: string; appliedAt: Date | string }[];
  pending: string[];
  exactStatus: "ALREADY_APPLIED" | "READY_TO_APPLY_EXACT_ONLY";
  exactAppliedAt: Date | string | null;
  catalog: {
    table: "weekly_goals" | "weekly_goal_private";
    exists: boolean;
    verified: boolean;
    rls: boolean | null;
    policies: number | null;
    browserAccess: { role: "anon" | "authenticated"; access: boolean }[];
    serverCanStore: boolean | null;
  }[];
}

export function parseArgs(args: string[]): { execute: boolean };
export function pinnedMigration(files: MigrationInventoryFile[]): MigrationFile;
export function preflight(client: MigrationClient, files: MigrationInventoryFile[]): Promise<MigrationReport<"PREFLIGHT_READ_ONLY">>;
export function executeExact(client: MigrationClient, files: MigrationInventoryFile[]): Promise<MigrationReport<"NO_OP" | "APPLIED_EXACT_ONLY">>;
export function main(args?: string[], runtime?: MigrationRuntime): Promise<MigrationReport>;
