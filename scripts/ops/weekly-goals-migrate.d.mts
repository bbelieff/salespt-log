// Scoped declarations for the plain-JavaScript operational runner (allowJs remains false).
import type { MigrationFile } from "../db-migrate.mjs";

export const VERSION: "0005_weekly_goals.sql";
export const EXPECTED_CHECKSUM: string;
export const LOCK_KEY: 786569;

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
export function pinnedMigration(files: MigrationFile[]): MigrationFile;
export function preflight(client: MigrationClient, files: MigrationFile[]): Promise<MigrationReport<"PREFLIGHT_READ_ONLY">>;
export function executeExact(client: MigrationClient, files: MigrationFile[]): Promise<MigrationReport<"NO_OP" | "APPLIED_EXACT_ONLY">>;
export function main(args?: string[]): Promise<MigrationReport>;
