import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { buildArtifact, verifyArtifact, validateInputs, validateInventory, sha256, PAYLOAD } from "../../scripts/ops/weekly-goals-delivery.mjs";
import { EXPECTED_CHECKSUM, VERSION } from "../../scripts/ops/weekly-goals-migrate.mjs";

const root = process.cwd();
const inputs = { sha: "a".repeat(40), actualSha: "a".repeat(40), sqlChecksum: EXPECTED_CHECKSUM,
  mode: VERSION, execute: "false", runId: "123", attempt: "1" };
let artifact: string;
let report: Awaited<ReturnType<typeof buildArtifact>>;
beforeAll(async () => {
  const fixture = await mkdtemp(join(tmpdir(), "weekly-delivery-fixture-"));
  artifact = join(fixture, "payload");
  report = await buildArtifact(root, artifact, inputs);
});

describe("weekly-goals immutable delivery (synthetic filesystem, no SSH/DB)", () => {
  it("binds exact sha/run/attempt and allowlisted SQL to external stage", () => {
    expect(validateInputs(inputs)).toBe(`/opt/salespt-migrations/123-1-${inputs.sha}`);
  });
  it.each([
    { sha: "main" }, { actualSha: "b".repeat(40) }, { sha: "A".repeat(40) },
    { mode: "installed" }, { mode: "0004_any.sql" }, { execute: "yes" },
    { sqlChecksum: "b".repeat(64) }, { runId: "../123" }, { attempt: "1;true" },
  ])("rejects unsafe or mismatched dispatch inputs %j", (change) => {
    expect(() => validateInputs({ ...inputs, ...change })).toThrow("DELIVERY_");
  });
  it("ships only exact SQL plus hashes for unrelated pending; verifies every helper byte", async () => {
    const result = await verifyArtifact(artifact, inputs.sha, report.manifestChecksum, EXPECTED_CHECKSUM);
    expect(Object.keys(report.files).sort()).toEqual([...PAYLOAD].sort());
    expect(result.files.length).toBeGreaterThan(1);
    expect(result.files.filter((f) => f.sql).map((f) => f.version)).toEqual([VERSION]);
    expect(await readdir(join(artifact, "lib/repo/db/migrations"))).toEqual([VERSION]);
    expect(report.files["scripts/ops/weekly-goals-migrate.mjs"]).toBe(sha256(await readFile(resolve(root, "scripts/ops/weekly-goals-migrate.mjs"))));
    expect(result.files.filter((f) => f.version.startsWith("0002_")).length).toBeGreaterThan(1);
  });
  it("never overwrites existing artifact evidence", async () => {
    await expect(buildArtifact(root, artifact, inputs)).rejects.toThrow();
  });
  it("rejects expected manifest, SHA and SQL mismatches", async () => {
    await expect(verifyArtifact(artifact, inputs.sha, "0".repeat(64), EXPECTED_CHECKSUM)).rejects.toThrow("MANIFEST_CHECKSUM");
    await expect(verifyArtifact(artifact, "b".repeat(40), report.manifestChecksum, EXPECTED_CHECKSUM)).rejects.toThrow("MANIFEST_CONTRACT");
    await expect(verifyArtifact(artifact, inputs.sha, report.manifestChecksum, "0".repeat(64))).rejects.toThrow("EXPECTED_VALUES");
  });
  it("rejects duplicate filename, traversal, unexpected inventory properties", () => {
    const target = { version: VERSION, checksum: EXPECTED_CHECKSUM };
    expect(() => validateInventory([target, target])).toThrow("INVENTORY_INVALID");
    expect(() => validateInventory([target, { version: "../0004_x.sql", checksum: "a".repeat(64) }])).toThrow();
    expect(() => validateInventory([{ ...target, sql: "should not travel" }])).toThrow();
  });
  it("rejects helper tampering and an extra unapproved SQL file", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "weekly-delivery-tamper-"));
    const path = join(fixture, "payload");
    const made = await buildArtifact(root, path, inputs);
    await writeFile(join(path, "scripts/ops/weekly-goals-migrate.mjs"), "// altered fixture");
    await expect(verifyArtifact(path, inputs.sha, made.manifestChecksum, EXPECTED_CHECKSUM)).rejects.toThrow("FILE_CHECKSUM");
    await writeFile(join(path, "lib/repo/db/migrations/0004_extra.sql"), "-- unapproved fixture");
    await expect(verifyArtifact(path, inputs.sha, made.manifestChecksum, EXPECTED_CHECKSUM)).rejects.toThrow("FILE_INVENTORY");
  });
});

describe("weekly-goals protected delivery workflow contract", () => {
  it("rejects feature-ref broad execution and validates before secrets/SSH", async () => {
    const workflow = await readFile(resolve(root, ".github/workflows/db-migrate.yml"), "utf8");
    expect(workflow).toContain('[[ "$GITHUB_REF" == refs/heads/master ]]');
    expect(workflow).toContain('"$GITHUB_SHA" == "$EXPECTED_SHA"');
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("ref: ${{ inputs.expected_sha }}");
    expect(workflow.indexOf("Validate dispatch")).toBeLessThan(workflow.indexOf("Setup SSH"));
    expect(workflow).toContain("if: inputs.mode == 'installed'");
    expect(workflow).toContain("group: db-migrate");
    expect(workflow).toContain("cancel-in-progress: false");
  });
  it("verifies archive before extraction, all payload before ready, preflight before execute", async () => {
    const ssh = await readFile(resolve(root, "scripts/ops/weekly-goals-delivery-ssh.sh"), "utf8");
    expect(ssh.indexOf("sha256sum '$STAGE/payload.tar.partial'")).toBeLessThan(ssh.indexOf("tar --no-same-owner"));
    expect(ssh.indexOf(" verify '")).toBeLessThan(ssh.indexOf("> '$STAGE/ARTIFACT_READY'"));
    expect(ssh.indexOf("$RUNNER preflight")).toBeLessThan(ssh.indexOf("$RUNNER execute"));
    expect(ssh).toContain('[[ "$rc" != 255 ]] && return "$rc"');
    expect(ssh).toContain("StrictHostKeyChecking=accept-new");
    expect(ssh).toContain("ServerAliveCountMax=4");
    expect(ssh).toContain("test ! -L /opt/salespt-migrations");
    expect(ssh).toContain("realpath /opt/salespt-migrations");
    expect(ssh).toContain("realpath '$STAGE/payload'");
    expect(ssh).toContain("test ! -L '$STAGE/preflight-result.json'");
    expect(ssh).not.toMatch(/git (fetch|checkout|reset)|npm (ci|install|run)|pm2|\.env\b|DATABASE_URL|db-migrate\.mjs --dry-run/);
  });
});
