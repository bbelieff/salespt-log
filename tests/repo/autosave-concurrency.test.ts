import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { IdemPool } from "@/repo/db/expense-idempotency";

// CI requires this. Each module instance represents a separate application worker.
// Only a temporary socket-only database is used; no application credentials.
describe.skipIf(process.env.TRAINER_CONCURRENCY_PG !== "1")("autosave independent PostgreSQL workers", () => {
  let dir: string, bin: string, pool: Pool;
  let started = false;
  beforeAll(async () => {
    bin = process.env.TRAINER_CONCURRENCY_PG_BIN || readdirSync("/usr/lib/postgresql")
      .sort((a,b) => Number(b)-Number(a)).map(v => `/usr/lib/postgresql/${v}/bin`).find(v => existsSync(join(v,"initdb")))!;
    if (!bin) throw new Error("PostgreSQL binaries required");
    dir = mkdtempSync(join(tmpdir(), "autosave-concurrency-"));
    const args = ["-D",join(dir,"data"),"-A","trust","-U","autosave_test","--no-locale","--encoding=UTF8"];
    if (process.env.TRAINER_CONCURRENCY_PG_SHARE) args.push("-L",process.env.TRAINER_CONCURRENCY_PG_SHARE);
    execFileSync(join(bin,"initdb"),args,{stdio:"pipe"});
    execFileSync(join(bin,"pg_ctl"),["-D",join(dir,"data"),"-l",join(dir,"server.log"),"-o",`-k ${dir} -c listen_addresses='' -c unix_socket_permissions=0700`,"-w","start"],{stdio:"pipe"});
    started = true;
    pool = new Pool({host:dir,user:"autosave_test",database:"postgres",max:6});
    await pool.query(`create table sheet_rows (
      id bigserial primary key, cohort text not null, email text,
      spreadsheet_id text not null, tab text not null, row_key text not null,
      payload jsonb not null, updated_at timestamptz not null default now(),
      unique (spreadsheet_id, tab, row_key))`);
  },30000);
  afterAll(async () => {
    if (pool) await pool.end();
    if (started) execFileSync(join(bin,"pg_ctl"),["-D",join(dir,"data"),"-m","fast","-w","stop"],{stdio:"pipe"});
    if (dir) rmSync(dir,{recursive:true,force:true});
  });

  it.each([true,false])("serializes separate workers (same key=%s) until write and completion", async sameKey => {
    vi.resetModules();
    const a = await import("@/repo/db/db-append-idempotency");
    vi.resetModules();
    const b = await import("@/repo/db/db-append-idempotency");
    expect(a.withScopeLock).not.toBe(b.withScopeLock);
    const sid = randomUUID(), key = randomUUID();
    const sheet = new Map<number,string>();
    const writes: number[] = [];
    let firstPid = 0, secondPid = 0;
    let entered!: () => void, release!: () => void;
    const entering = new Promise<void>(r => {entered = r;});
    const hold = new Promise<void>(r => {release = r;});
    const workerPool = (worker: "a" | "b") => ({
      query: (sql: string, values?: unknown[]) => pool.query(sql,values),
      connect: async () => {
        const c = await pool.connect();
        return {release: (err?: Error) => c.release(err), query: async (sql: string, values?: unknown[]) => {
          if (sql.includes("pg_advisory_lock(")) {
            const pid = (c as unknown as {processID:number}).processID;
            if (worker === "a") firstPid = pid; else secondPid = pid;
          }
          return c.query(sql,values);
        }};
      },
    }) as unknown as IdemPool;
    const payload = {company:"synthetic",amount:100};
    const ops = (worker: "a" | "b") => ({
      findEmptyRow: async (excluded?: Set<number>) => {let n = 4; while (sheet.has(n) || excluded?.has(n)) n++; return n;},
      writeAt: async (row: number) => {
        if (worker === "a") {entered(); await hold;}
        writes.push(row); sheet.set(row,worker);
      },
    });
    const run = (mod: typeof a, worker: "a" | "b", requestKey: string) => mod.appendDbRowIdempotent({
      spreadsheetId:sid,section:"purchase",key:requestKey,business:payload,ops:ops(worker),
      deps:{pool:workerPool(worker),skipEnsure:true},
    });
    const one = run(a,"a",key);
    let two: ReturnType<typeof run> | undefined;
    let observed = false;
    try {
      await entering;
      two = run(b,"b",sameKey ? key : randomUUID());
      const deadline = Date.now()+1800;
      while (Date.now()<deadline) {
        if (secondPid) {
          const {rows} = await pool.query("select wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1",[secondPid]);
          if (rows[0]?.wait_event_type === "Lock" && rows[0]?.wait_event === "advisory" && rows[0]?.blockers.includes(firstPid)) {observed=true;break;}
        }
        await new Promise(r => setTimeout(r,10));
      }
    } finally {release();}
    const result = await Promise.all([one,two!]);
    expect(firstPid).not.toBe(secondPid);
    expect(observed,"another app worker must wait until external write AND durable completion").toBe(true);
    expect(new Set(result.map(r => r.row)).size).toBe(sameKey ? 1 : 2);
    expect(writes.length).toBe(sameKey ? 1 : 2);
    expect(sheet.size).toBe(sameKey ? 1 : 2);
  },15000);
});
