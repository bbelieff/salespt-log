/** call_records 저장소 — 일회성 PGlite 위 실제 SQL. 대기열은 한 번만 가져가고, 끝나면 녹음 경로를 돌려주고 비운다. 가상 값만 쓴다. */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("pg", () => ({
  Pool: class {
    async query(text: string, params?: unknown[]) {
      const r = await fixture.db!.query(text, (params ?? []) as never[]);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    }
  },
}));

const ORIGINAL_URL = process.env.DATABASE_URL;
const sheet = "call-synthetic";
const email = "Caller@Example.test";
let repo: typeof import("@/repo/db/call-records");

beforeAll(async () => {
  fixture.db = new PGlite();
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0014_call_records.sql", "utf8"));
  process.env.DATABASE_URL = "postgres://isolated.invalid/unused";
  vi.resetModules();
  repo = await import("@/repo/db/call-records");
}, 60_000);
afterAll(async () => {
  await fixture.db?.close();
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = ORIGINAL_URL;
});
beforeEach(async () => { await fixture.db!.exec("delete from call_records"); });

const lead = async () => {
  const id = randomUUID();
  await fixture.db!.query("insert into db_sheet_leads(spreadsheet_id,id,revision,data) values($1,$2,1,'{}')", [sheet, id]);
  return id;
};
const audio = { source: "audio" as const, audioPath: "/tmp/call-audio/a.m4a", transcript: "" };
const age = (id: string, minutes: number) =>
  fixture.db!.query(`update call_records set started_at=now()-make_interval(mins=>$2), updated_at=now()-make_interval(mins=>$2) where id=$1`, [id, minutes]);

it("📞 는 dialed, 녹음을 올리면 queued — 남의 통화는 못 올린다", async () => {
  const leadId = await lead();
  const id = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:02:00Z" });
  expect((await repo.getCall(email, id))?.status).toBe("dialed");
  expect(await repo.queueCall("other@example.test", id, audio)).toBe(false);
  expect(await repo.queueCall(email, id, audio)).toBe(true);
  const c = await repo.getCall("caller@example.test", id);
  expect(c).toMatchObject({ status: "queued", source: "audio", leadId, calledAt: "2026-11-01T05:02:00.000Z", email: "caller@example.test" });
  expect(await repo.queueCall(email, id, audio)).toBe(false);
});

it("대기열은 오래된 것부터 한 번만 가져간다", async () => {
  const leadId = await lead();
  const first = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  const second = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:10:00Z", upload: { source: "text", audioPath: null, transcript: "나: 안녕하세요" } });
  await fixture.db!.query("update call_records set created_at=now()-interval '1 minute' where id=$1", [first]);
  const a = await repo.claimNextCall();
  expect(a).toMatchObject({ id: first, status: "processing", attempts: 1, audioPath: "/tmp/call-audio/a.m4a" });
  const b = await repo.claimNextCall();
  expect(b).toMatchObject({ id: second, source: "text", transcript: "나: 안녕하세요" });
  expect(await repo.claimNextCall()).toBeNull();
});

it("정리 끝 → review, 녹음 경로를 돌려주고 비운다", async () => {
  const id = await repo.createCall({ spreadsheetId: sheet, leadId: await lead(), email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  await repo.claimNextCall();
  const done = await repo.finishCall(id, { transcript: "나: 네", raw: { memo: "x" }, extraction: { memo: "매출 12억" } as never, audioSeconds: 152 });
  expect(done).toEqual({ ok: true, audioPath: "/tmp/call-audio/a.m4a" });
  const c = await repo.getCall(email, id);
  expect(c).toMatchObject({ status: "review", transcript: "나: 네", audioSeconds: 152 });
  expect(c?.extraction?.memo).toBe("매출 12억");
  expect(c?.extraction?.answered).toEqual([]);
  expect(await repo.finishCall(id, { transcript: "", raw: {}, extraction: {} as never, audioSeconds: null })).toEqual({ ok: false, audioPath: null });
});

it("잠깐의 오류는 다시 대기, 세 번째면 failed 이고 녹음도 비운다", async () => {
  const id = await repo.createCall({ spreadsheetId: sheet, leadId: await lead(), email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  for (let i = 1; i < repo.CALL_MAX_ATTEMPTS; i++) {
    await repo.claimNextCall();
    expect(await repo.retryCall(id, "AI 가 바빠요(429)")).toBe("queued");
  }
  await repo.claimNextCall();
  expect(await repo.retryCall(id, "AI 가 바빠요(429)")).toBe("failed");
  expect(await repo.staleCallAudio(0)).toEqual([]);
  expect((await repo.getCall(email, id))?.error).toBe("AI 가 바빠요(429)");
});

it("멈춘 processing 은 다시 가져가고, 횟수를 넘으면 failed", async () => {
  const id = await repo.createCall({ spreadsheetId: sheet, leadId: await lead(), email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  await repo.claimNextCall();
  expect(await repo.claimNextCall()).toBeNull();
  await age(id, repo.CALL_STALE_MINUTES + 1);
  expect((await repo.claimNextCall())?.attempts).toBe(2);
  await age(id, repo.CALL_STALE_MINUTES + 1);
  expect((await repo.claimNextCall())?.attempts).toBe(3);
  await age(id, repo.CALL_STALE_MINUTES + 1);
  expect(await repo.claimNextCall()).toBeNull();
  expect((await repo.getCall(email, id))?.status).toBe("failed");
});

it("실패 후 다시 올릴 수 있다", async () => {
  const id = await repo.createCall({ spreadsheetId: sheet, leadId: await lead(), email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  await repo.claimNextCall();
  expect(await repo.failCall(id, "AI 정리가 아직 설정되지 않았어요")).toEqual({ ok: true, audioPath: "/tmp/call-audio/a.m4a" });
  expect(await repo.queueCall(email, id, audio)).toBe(true);
  expect(await repo.getCall(email, id)).toMatchObject({ status: "queued", attempts: 0, error: "" });
});

it("오래 남은 녹음 원본을 찾아 비운다(처리 중인 것은 건드리지 않음)", async () => {
  const leadId = await lead();
  const left = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  await age(left, 25 * 60);
  expect(await repo.staleCallAudio(24)).toEqual([{ id: left, audioPath: "/tmp/call-audio/a.m4a" }]);
  await repo.clearCallAudio(left);
  expect(await repo.staleCallAudio(0)).toEqual([]);
  expect((await repo.listCallsForLead(sheet, leadId)).map(c => c.id)).toEqual([left]);
});

it("없는 업체로는 못 만든다, 하루 올린 수, 닫기는 녹음 경로를 돌려준다", async () => {
  await expect(repo.createCall({ spreadsheetId: sheet, leadId: randomUUID(), email, calledAt: "2026-11-01T05:00:00Z" })).rejects.toBeInstanceOf(repo.CallLeadMissing);
  const leadId = await lead();
  const since = new Date(Date.now() - 60_000);
  const dialed = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:00:00Z" });
  const up = await repo.createCall({ spreadsheetId: sheet, leadId, email, calledAt: "2026-11-01T05:00:00Z", upload: audio });
  expect(await repo.countCallUploadsSince(email, since)).toBe(1);
  expect(await repo.discardCall("other@example.test", up)).toEqual({ ok: false, audioPath: null });
  expect(await repo.discardCall(email, up)).toEqual({ ok: true, audioPath: "/tmp/call-audio/a.m4a" });
  expect((await repo.getCall(email, up))?.status).toBe("discarded");
  await repo.claimNextCall();
  expect(await repo.discardCall(email, up)).toEqual({ ok: false, audioPath: null });
  expect(await repo.discardCall(email, dialed)).toEqual({ ok: true, audioPath: null });
});
