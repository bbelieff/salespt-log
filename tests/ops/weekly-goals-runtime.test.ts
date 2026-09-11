import { describe, expect, it } from "vitest";
import { parseProcessEnv, selectPm2, compareResolvedUrls, inspectEnvironmentFiles, assertNoPgOverrides } from "../../scripts/ops/weekly-goals-runtime.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { validateInputs } from "../../scripts/ops/weekly-goals-delivery.mjs";
import { EXPECTED_CHECKSUM, VERSION } from "../../scripts/ops/weekly-goals-migrate.mjs";
const base = { sha:"a".repeat(40),actualSha:"a".repeat(40),sqlChecksum:EXPECTED_CHECKSUM,mode:VERSION,execute:"false",runId:"1",attempt:"1" };
describe("runtime and approval boundaries (synthetic; no PM2/remote access)", () => {
  it.each([false,true])("replays installed Next production file priority and process-env precedence: %s", async processOverride => {
    const root = await mkdtemp(resolve(".qa-runtime-fixture-"));
    try {
      await writeFile(join(root,"package.json"),'{"name":"synthetic-env-fixture"}');
      await writeFile(join(root,".env"),"DATABASE_URL=base-fixture");
      await writeFile(join(root,".env.production"),"DATABASE_URL=production-fixture");
      await writeFile(join(root,".env.local"),"DATABASE_URL=local-fixture");
      await writeFile(join(root,".env.production.local"),"FIXTURE_HOST=priority-fixture\nDATABASE_URL=\${FIXTURE_HOST}");
      const module = pathToFileURL(resolve("scripts/ops/weekly-goals-runtime.mjs")).href;
      const code = `const {resolveNextEnvironment}=await import(${JSON.stringify(module)});const r=resolveNextEnvironment(process.cwd());console.log(JSON.stringify({matches:r.combinedEnv.DATABASE_URL===process.env.FIXTURE_EXPECTED}));`;
      const result = spawnSync(process.execPath,["--input-type=module","-e",code], {cwd:root,encoding:"utf8",timeout:10000,
        env:{...process.env,NODE_OPTIONS:undefined,NODE_ENV:"production",__NEXT_PROCESSED_ENV:undefined,
          DATABASE_URL:processOverride ? "process-fixture" : undefined,FIXTURE_HOST:undefined,
          FIXTURE_EXPECTED:processOverride ? "process-fixture" : "priority-fixture"}});
      expect(result.status).toBe(0); expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual({matches:true});
      expect(result.stdout).not.toContain("fixture");
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("rejects env files changed after process start; observation exposes hashes not values", async () => {
    const root = await mkdtemp(resolve(".qa-runtime-fixture-"));
    try {
      await writeFile(join(root,".env"),"DATABASE_URL=private-fixture");
      const metadata = await inspectEnvironmentFiles(root,Date.now()+1000);
      expect(JSON.stringify(metadata)).not.toContain("private-fixture");
      await expect(inspectEnvironmentFiles(root,Date.now()-60000)).rejects.toThrow();
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("allows normal post-reload build-directory cleanup with unchanged environment files", async () => {
    const root = await mkdtemp(resolve(".qa-runtime-fixture-"));
    try {
      await writeFile(join(root,".env"),"DATABASE_URL=private-fixture");
      const startedAt = Date.now() + 1000;
      const before = await inspectEnvironmentFiles(root, startedAt);
      await new Promise(done => setTimeout(done, 1100));
      await writeFile(join(root,"old-build-entry"),"unrelated-build");
      await rm(join(root,"old-build-entry"));
      expect(await inspectEnvironmentFiles(root, startedAt)).toEqual(before);
      await writeFile(join(root,".env"),"DATABASE_URL=changed-private-fixture");
      await expect(inspectEnvironmentFiles(root, startedAt)).rejects.toThrow();
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("parses initial process env privately including equals, rejects duplicate ambiguity", () => {
    expect(parseProcessEnv("A=x=y\0B=z\0")).toEqual({A:"x=y",B:"z"});
    expect(() => parseProcessEnv("A=x\0A=y\0")).toThrow();
  });
  it("fails on PostgreSQL fallback environment rather than comparing with observer defaults", () => {
    expect(() => assertNoPgOverrides({DATABASE_URL:"fixture"})).not.toThrow();
    for(const key of ["PGHOST","PGUSER","PGPASSWORD","PGOPTIONS","PGSERVICE"]) {
      expect(() => assertNoPgOverrides({[key]:"fixture"})).toThrow();
    }
  });
  it("requires exactly one online PM2 app at fixed directory", () => {
    const app={name:"salespt-log",pid:123,pm2_env:{status:"online",pm_cwd:"/opt/salespt-log"}};
    expect(selectPm2([app])).toBe(123);
    expect(() => selectPm2([app,app])).toThrow();
    expect(() => selectPm2([{...app,pm2_env:{...app.pm2_env,status:"stopped"}}])).toThrow();
    expect(() => selectPm2([{...app,pm2_env:{...app.pm2_env,pm_cwd:"/other"}}])).toThrow();
  });
  it("returns only matching booleans, rejecting endpoint/role/options ambiguity", () => {
    const a="postgresql://fixture@localhost/fixture";
    expect(compareResolvedUrls(a,a)).toEqual({targetMatches:true,configuredRoleMatches:true});
    expect(compareResolvedUrls(a,a.replace("localhost","elsewhere")).targetMatches).toBe(false);
    expect(compareResolvedUrls(a,"postgresql://other@localhost/fixture").configuredRoleMatches).toBe(false);
    expect(compareResolvedUrls(a,a+"?options=fixture").targetMatches).toBe(false);
    expect(() => compareResolvedUrls("https://localhost/",a)).toThrow();
  });
  it("repair defaults false; writes require comparison; repair never combines with apply", () => {
    expect(() => validateInputs(base)).not.toThrow();
    expect(() => validateInputs({...base,repairHistoryAcl:"true"})).toThrow();
    expect(() => validateInputs({...base,execute:"true"})).toThrow();
    expect(() => validateInputs({...base,repairHistoryAcl:"true",compareRuntime:"true"})).not.toThrow();
    expect(() => validateInputs({...base,repairHistoryAcl:"true",compareRuntime:"true",execute:"true"})).toThrow();
    expect(() => validateInputs({...base,compareRuntime:"yes"})).toThrow();
  });
});
