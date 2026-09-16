import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";

const state = vi.hoisted(() => ({ pool: null as unknown }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => state.pool }));
import { applyForTrainer, changeTrainerQualification, createTrainerInvite, acceptTrainerInvite, revokeTrainerInvite } from "@/repo/db/trainer-recruitment";

// Opt-in locally; required by CI. Starts its own socket-only PostgreSQL, never reads DATABASE_URL.
const enabled = process.env.TRAINER_CONCURRENCY_PG === "1";
describe.skipIf(!enabled)("real independent PostgreSQL recruitment transactions", () => {
  let dir: string, bin: string, pool: Pool;
  let started = false;
  let gate: { firstPid: number; secondPid: number; entered: Promise<void>; enter: () => void; release: () => void; hold: Promise<void> } | null = null;
  beforeAll(async () => {
    bin = process.env.TRAINER_CONCURRENCY_PG_BIN || readdirSync("/usr/lib/postgresql")
      .sort((a,b) => Number(b)-Number(a)).map(v => `/usr/lib/postgresql/${v}/bin`).find(v => existsSync(join(v,"initdb")))!;
    if (!bin) throw new Error("PostgreSQL binaries required for explicit concurrency verification");
    dir = mkdtempSync(join(tmpdir(), "trainer-concurrency-"));
    const data = join(dir,"data");
    const args = ["-D",data,"-A","trust","-U","recruitment_test","--no-locale","--encoding=UTF8"];
    if (process.env.TRAINER_CONCURRENCY_PG_SHARE) args.push("-L",process.env.TRAINER_CONCURRENCY_PG_SHARE);
    execFileSync(join(bin,"initdb"),args,{stdio:"pipe"});
    // Empty listen_addresses: no TCP listener or remote database path.
    execFileSync(join(bin,"pg_ctl"),["-D",data,"-l",join(dir,"server.log"),"-o",`-k ${dir} -c listen_addresses='' -c unix_socket_permissions=0700`,"-w","start"],{stdio:"pipe"});
    started = true;
    pool = new Pool({host:dir,user:"recruitment_test",database:"postgres",port:5432,max:4});
    state.pool = {
      query: (sql: string, values?: unknown[]) => pool.query(sql,values),
      connect: async () => {
        const client = await pool.connect();
        return {release: () => client.release(), query: async (sql: string, values?: unknown[]) => {
          const current = gate;
          const locking = sql.includes("pg_advisory_xact_lock");
          const first = locking && current && !current.firstPid;
          if (locking && current) {
            const pid = (client as unknown as {processID:number}).processID;
            if (first) current.firstPid = pid; else current.secondPid = pid;
          }
          const result = await client.query(sql,values);
          // Pause only after the real first connection has acquired the DB lock.
          if (first && current) {current.enter(); await current.hold;}
          return result;
        }};
      },
    };
    await pool.query("create role anon; create role authenticated");
    await pool.query(readFileSync("lib/repo/db/migrations/0001_users_cohorts.sql","utf8"));
    await pool.query(readFileSync("lib/repo/db/migrations/0006_trainer_recruitment.sql","utf8"));
    // Test-only audit counts every active qualification write, including redundant updates.
    await pool.query(`create table activation_audit(email text);
      create function audit_activation() returns trigger language plpgsql as $$begin
        if NEW.status='active' then insert into activation_audit values(NEW.email); end if; return NEW; end$$;
      create trigger activation_audit after insert or update on trainer_qualifications for each row execute function audit_activation()`);
    const {rows} = await pool.query("select version() as version");
    console.info("[trainer-concurrency]",JSON.stringify({database:rows[0].version,socketOnly:true}));
  },30000);
  afterAll(async () => {
    gate?.release(); gate = null;
    if (pool) await pool.end();
    if (started) execFileSync(join(bin,"pg_ctl"),["-D",join(dir,"data"),"-m","fast","-w","stop"],{stdio:"pipe"});
    if (dir) rmSync(dir,{recursive:true,force:true});
  });

  async function race(label: string, first: () => Promise<unknown>, second: () => Promise<unknown>) {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(r => {enter=r;});
    const hold = new Promise<void>(r => {release=r;});
    const current = {firstPid:0,secondPid:0,entered,enter,release,hold};
    gate = current;
    const settled = (work: () => Promise<unknown>) => work().then(value => ({ok:true,value}),error => ({ok:false,error:String(error)}));
    const a = settled(first);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([entered,new Promise((_,reject) => {timer=setTimeout(() => reject(new Error("first lock not acquired")),3000);})]);
      clearTimeout(timer);
      const b = settled(second);
      try {
        let observed = false;
        const deadline = Date.now()+3000;
        while (Date.now()<deadline) {
          if (current.secondPid) {
            const {rows} = await pool.query("select wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1",[current.secondPid]);
            if (rows[0]?.wait_event_type === "Lock" && rows[0]?.wait_event === "advisory" && rows[0]?.blockers.includes(current.firstPid)) {observed=true;break;}
          }
          await new Promise(r => setTimeout(r,10));
        }
        expect(current.secondPid).not.toBe(current.firstPid);
        expect(observed,"independent second backend must wait on first recipient advisory lock").toBe(true);
        console.info("[trainer-concurrency]",JSON.stringify({case:label,independentConnections:true,waitEvent:"advisory",blockingObserved:observed}));
      } finally {release();}
      return await Promise.all([a,b]);
    } finally {clearTimeout(timer);release();gate=null;}
  }
  async function status(email: string) {return (await pool.query("select status from trainer_qualifications where email=$1",[email])).rows[0]?.status;}
  it.each(["approve","cancel"] as const)("%s first serializes approval/cancellation, including retries",async(first) => {
    const email = `${first}@example.test`, second = first === "approve" ? "cancel" : "approve";
    await applyForTrainer(email,"Synthetic");
    const result = await race(`${first}-then-${second}`,() => changeTrainerQualification(email,first,email),() => changeTrainerQualification(email,second,email));
    expect(result[0].ok).toBe(true); expect(result[1]).toMatchObject({ok:false,error:expect.stringContaining("invalid_transition")});
    expect(await status(email)).toBe(first === "approve" ? "active" : "cancelled");
    await changeTrainerQualification(email,first,email);
    await expect(changeTrainerQualification(email,second,email)).rejects.toThrow("invalid_transition");
  });
  it.each(["accept","revoke"] as const)("%s first serializes invitation acceptance/revocation",async(first) => {
    const email = `${first}@example.test`, invite = await createTrainerInvite("admin@example.test",email);
    const accept = () => acceptTrainerInvite(invite.token,email,"Synthetic");
    const revoke = () => revokeTrainerInvite(invite.id,"admin@example.test");
    const result = await race(`${first}-first`,first === "accept" ? accept : revoke,first === "accept" ? revoke : accept);
    expect(result[0].ok).toBe(true); expect(result[1]).toMatchObject({ok:false,error:expect.stringContaining("invalid_invitation")});
    if (first === "accept") {
      expect(await status(email)).toBe("active"); await accept(); await expect(revoke()).rejects.toThrow("invalid_invitation");
      expect((await pool.query("select count(*)::int as n from activation_audit where email=$1",[email])).rows[0].n).toBe(1);
    } else {
      expect(await status(email)).toBeUndefined(); await revoke(); await expect(accept()).rejects.toThrow("invalid_invitation");
    }
  });
  it("concurrent duplicate acceptance writes active once and remains retry-idempotent",async() => {
    const email="duplicate@example.test", invite=await createTrainerInvite("admin@example.test",email);
    const accept=()=>acceptTrainerInvite(invite.token,email,"Synthetic");
    const result=await race("duplicate-accept",accept,accept);
    expect(result.map(r=>r.ok)).toEqual([true,true]);
    await accept();
    expect(await status(email)).toBe("active");
    expect((await pool.query("select count(*)::int as n from activation_audit where email=$1",[email])).rows[0].n).toBe(1);
  });
});
