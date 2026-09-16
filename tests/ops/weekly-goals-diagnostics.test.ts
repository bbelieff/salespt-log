import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationFiles } from "../../scripts/db-migrate.mjs";
import { main, preflight, EXPECTED_CHECKSUM } from "../../scripts/ops/weekly-goals-migrate.mjs";
import { MigrationGateError, formatMigrationFailure } from "../../scripts/ops/weekly-goals-migrate-catalog.mjs";
import { runDeliveryCLI } from "../../scripts/ops/weekly-goals-delivery-run.mjs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

vi.mock("../../scripts/ops/weekly-goals-migrate.mjs", async (original) => ({
  ...await original<typeof import("../../scripts/ops/weekly-goals-migrate.mjs")>(), main: vi.fn(),
}));
vi.mock("../../scripts/ops/weekly-goals-delivery.mjs", () => ({
  verifyArtifact: vi.fn(async () => ({ files: [] })),
}));
let files: Awaited<ReturnType<typeof loadMigrationFiles>>;
beforeAll(async () => { files = await loadMigrationFiles(); });
afterEach(() => { vi.restoreAllMocks(); vi.mocked(main).mockReset(); });
const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const sentinel = "fixture-sensitive-driver-detail";
function clientFixture(diagnosticFails = false) {
  const calls: string[] = [];
  return { calls, query: async (sql: string) => {
    calls.push(sql);
    if (sql.startsWith("select c.oid")) return { rows: [{ oid: 1, relkind: "r", rls: false, force_rls: false,
      policies: 0, triggers: 0, rules: 0, inheritance: 0, indexes: 1, valid_primary_indexes: 1,
      unexpected_acl: true, server_rls_bypass: true, server_dml: true }] };
    if (sql.startsWith("select a.attname")) return { rows: [
      { name: "version", type: "text", required: true, default_value: null },
      { name: "checksum", type: "text", required: true, default_value: null },
      { name: "applied_at", type: "timestamp with time zone", required: true, default_value: "now()" },
    ].map(c => ({ ...c, identity: "", generated: "", column_acl: false })) };
    if (sql.startsWith("select pg_get_constraintdef")) return { rows: [{ definition: "PRIMARY KEY (version)", validated: true }] };
    if (sql.startsWith("select r.rolname")) return { rows: [{ role: "anon", access: true }] };
    if (sql.startsWith("with target")) {
      if (diagnosticFails) throw new Error(sentinel);
      return { rows: ["PUBLIC", "anon", "authenticated", "SERVER"].flatMap(label => privileges.map(privilege => ({
        label, privilege, present: true, allowed: label === "SERVER" || privilege === "SELECT",
        column_grants: false, effective_column_access: true, unknown_table: 2, unknown_column: 1,
        unknown_total: 2, owner: label === "SERVER", superuser: false, bypass_rls: true,
        password: sentinel, arbitraryRole: sentinel,
      }))) };
    }
    return { rows: [] };
  } };
}
async function cliFailure(error?: Error, diagnosticFails = false) {
  const client = clientFixture(diagnosticFails);
  vi.mocked(main).mockImplementation(async () => { if (error) throw error; return preflight(client, files); });
  vi.spyOn(process, "cwd").mockReturnValue("/opt/salespt-log");
  const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
  const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
  const code = await runDeliveryCLI(["preflight", "a".repeat(40), "b".repeat(64), EXPECTED_CHECKSUM]);
  expect(code).toBe(1);
  expect(stdout).not.toHaveBeenCalled();
  expect(stderr).toHaveBeenCalledTimes(1);
  return { client, output: String(stderr.mock.calls[0]?.[0]) };
}
describe("weekly-goals actual delivery CLI failure path (synthetic catalog; no remote DB)", () => {
  it("actual Node CLI exits1 with a generic error before any DB lookup for invalid inputs", () => {
    const result = spawnSync(process.execPath,
      [resolve("scripts/ops/weekly-goals-delivery-run.mjs"), "invalid-mode", sentinel],
      { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("DELIVERY_FAILED_DETAILS_WITHHELD");
    expect(result.stderr).not.toContain(sentinel);
  });
  it("emits allowlisted metadata while failing, rolling back and never reading history data", async () => {
    const { client, output } = await cliFailure();
    const report = JSON.parse(output);
    expect(report.error).toBe("UNSAFE_HISTORY_SECURITY");
    expect(report.diagnostic).toMatchObject({ table: "public.schema_migrations", available: true, rls: false,
      grantees: { PUBLIC: { privileges: { SELECT: true, DELETE: false }, columnGrants: false } },
      unknownGrantees: { category: "NON_OWNER_NON_SERVICE_NON_BROWSER", table: 2, column: 1, total: 2 },
      server: { owner: true, privileges: { INSERT: true, UPDATE: true, DELETE: true } } });
    expect(output).not.toContain(sentinel);
    expect(client.calls[0]).toBe("begin read only");
    expect(client.calls.at(-1)).toBe("rollback");
    expect(client.calls.some(sql => /select version, checksum|\b(revoke|grant|alter|insert into|create table)\b/i.test(sql))).toBe(false);
    expect(client.calls.every(sql => /^(begin read only|set local (lock_timeout|statement_timeout)|select|with target|rollback)\b/i.test(sql))).toBe(true);
  });
  it("keeps nonzero denial and withholds driver details if metadata query itself fails", async () => {
    const { client, output } = await cliFailure(undefined, true);
    expect(JSON.parse(output)).toMatchObject({ error: "UNSAFE_HISTORY_SECURITY", diagnostic: { available: false } });
    expect(output).not.toContain(sentinel);
    expect(client.calls.at(-1)).toBe("rollback");
  });
  it("never serializes arbitrary driver error message/stack/connection fields", async () => {
    const error = Object.assign(new Error(sentinel), { connectionString: sentinel, password: sentinel, cause: sentinel });
    const { output } = await cliFailure(error);
    expect(output).toBe("DELIVERY_FAILED_DETAILS_WITHHELD");
  });
  it("projects typed errors again at output; arbitrary codes/messages/diagnostic keys cannot escape", () => {
    const error = new MigrationGateError("UNSAFE_HISTORY_SECURITY");
    error.message = sentinel;
    error.diagnostic = { table: sentinel, available: true, rls: sentinel, policies: sentinel,
      unknownGrantees: { table: -1, total: sentinel }, password: sentinel,
      grantees: { PUBLIC: { privileges: { SELECT: sentinel, EXTRA: sentinel } } } };
    const output = formatMigrationFailure(error, "WITHHELD");
    expect(output).not.toContain(sentinel);
    expect(JSON.parse(output).diagnostic).toMatchObject({ table: "public.schema_migrations", rls: null,
      policies: null, unknownGrantees: { table: null, total: null } });
    expect(formatMigrationFailure(new MigrationGateError(sentinel), "WITHHELD")).toBe("WITHHELD");
  });
});
