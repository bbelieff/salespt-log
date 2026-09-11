import { expect, it, vi } from "vitest";
import { loadMigrationFiles } from "../../scripts/db-migrate.mjs";
import { DATABASE_LIMITS, VERSION, main } from "../../scripts/ops/weekly-goals-migrate.mjs";

const fixture = vi.hoisted(() => ({ options: {} as Record<string, unknown>, calls: [] as string[] }));
vi.mock("../../scripts/db-migrate.mjs", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../scripts/db-migrate.mjs")>(),
  resolveDatabaseUrl: () => "fixture-connection",
}));
vi.mock("pg", () => ({ Client: class {
  constructor(options: Record<string, unknown>) { fixture.options = options; }
  async connect() { fixture.calls.push("connect"); }
  async query(sql: string) { fixture.calls.push(sql); return { rows: [] }; }
  async end() { fixture.calls.push("end"); }
} }));

it("configures bounded connection/server/client waits and always closes the synthetic client", async () => {
  const files = (await loadMigrationFiles()).map((file) => file.version === VERSION ? file : {
    version: file.version, checksum: file.checksum,
  });
  const report = await main(["--preflight"], { files });
  expect(report.mode).toBe("PREFLIGHT_READ_ONLY");
  expect(report.pending).toContain(VERSION);
  expect(fixture.options).toMatchObject({ ...DATABASE_LIMITS });
  expect(fixture.options.connectionTimeoutMillis).toBe(15000);
  expect(fixture.options.lock_timeout).toBe(10000);
  expect(fixture.options.statement_timeout).toBe(60000);
  expect(fixture.options.query_timeout).toBe(65000);
  expect(fixture.calls.at(-1)).toBe("end");
});

it("rejects a protected env cwd mismatch before module resolution or connection", async () => {
  fixture.calls.length = 0;
  await expect(main(["--preflight"], { appRoot: "fixture-different-root" })).rejects.toThrow("APP_ROOT_CWD_MISMATCH");
  expect(fixture.calls).toEqual([]);
});
