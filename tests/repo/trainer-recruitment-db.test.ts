import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const state = vi.hoisted(() => ({ pool: null as unknown }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => state.pool }));
import { applyForTrainer, createTrainerInvite, acceptTrainerInvite, revokeTrainerInvite, changeTrainerQualification } from "@/repo/db/trainer-recruitment";
import { PGlite } from "@electric-sql/pglite";
describe("disposable PostgreSQL trainer qualification", () => {
  let db: any;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated;");
    state.pool = { query: (...args: any[]) => db.query(...args), connect: async () => ({ query: (...args: any[]) => db.query(...args), release() {} }) };
    await db.exec(readFileSync("lib/repo/db/migrations/0001_users_cohorts.sql", "utf8"));
    await db.exec(readFileSync("lib/repo/db/migrations/0006_trainer_recruitment.sql", "utf8"));
  });
  it("student application is pending without touching enrollment, repeat active does not demote", async () => {
    await db.query("insert into users(id,email,cohort,name,spreadsheet_id) values ('00000000-0000-0000-0000-000000000001','student@example.com','8','학생','own-sheet')");
    const before = (await db.query("select * from users")).rows;
    expect((await applyForTrainer("student@example.com", "신청자")).status).toBe("pending");
    await changeTrainerQualification("student@example.com", "approve", "admin@example.com");
    expect((await applyForTrainer("student@example.com", "재신청")).status).toBe("active");
    await changeTrainerQualification("student@example.com", "remove", "admin@example.com");
    expect((await db.query("select * from users")).rows).toEqual(before);
  });
  it("invitation stores only digest and requires matching recipient, single explicit acceptance", async () => {
    const invite = await createTrainerInvite("admin@example.com", "invitee@example.com");
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = (await db.query("select * from trainer_invitations where id=$1", [invite.id])).rows[0];
    expect(row.token_hash).toBe(createHash("sha256").update(invite.token).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(invite.token);
    await expect(acceptTrainerInvite(invite.token, "wrong@example.com", "잘못된계정")).rejects.toThrow("invalid_invitation");
    expect((await acceptTrainerInvite(invite.token, "invitee@example.com", "초대자")).status).toBe("active");
    expect((await acceptTrainerInvite(invite.token, "invitee@example.com", "초대자")).status).toBe("active");
    await changeTrainerQualification("invitee@example.com", "remove", "admin@example.com");
    await expect(acceptTrainerInvite(invite.token, "invitee@example.com", "초대자")).rejects.toThrow("invalid_invitation");
  });
  it("cancelled, expired, forged tokens never grant a role", async () => {
    const cancelled = await createTrainerInvite("admin@example.com", "cancel@example.com");
    await revokeTrainerInvite(cancelled.id, "admin@example.com");
    await expect(acceptTrainerInvite(cancelled.token, "cancel@example.com", "취소")).rejects.toThrow("invalid_invitation");
    const expired = await createTrainerInvite("admin@example.com", "expired@example.com");
    await db.query("update trainer_invitations set expires_at=now()-interval '1 second' where id=$1", [expired.id]);
    await expect(acceptTrainerInvite(expired.token, "expired@example.com", "만료")).rejects.toThrow("invalid_invitation");
    await expect(acceptTrainerInvite("x".repeat(43), "fake@example.com", "위조")).rejects.toThrow("invalid_invitation");
    expect((await db.query("select * from trainer_qualifications where email in ('cancel@example.com','expired@example.com','fake@example.com')")).rows).toEqual([]);
  });
  it("cancellation and reapplication change only qualification; stale cancel never demotes active", async () => {
    const before=(await db.query("select * from users order by id")).rows;
    await applyForTrainer("student@example.com","학생");
    await changeTrainerQualification("student@example.com","cancel","student@example.com");
    await changeTrainerQualification("student@example.com","cancel","student@example.com");
    expect((await db.query("select status from trainer_qualifications where email='student@example.com'")).rows[0].status).toBe("cancelled");
    await expect(changeTrainerQualification("student@example.com","approve","admin@example.com")).rejects.toThrow("invalid_transition");
    expect((await applyForTrainer("student@example.com","학생")).status).toBe("pending");
    await changeTrainerQualification("student@example.com","approve","admin@example.com");
    await expect(changeTrainerQualification("student@example.com","cancel","student@example.com")).rejects.toThrow("invalid_transition");
    expect((await db.query("select * from users order by id")).rows).toEqual(before);
  });
  it("public API roles cannot read tokens or create qualifications", async () => {
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      for(const sql of ["select * from trainer_invitations","select * from trainer_qualifications", "insert into trainer_qualifications(email,name,status,updated_by) values('bad@example.com','bad','active','bad@example.com')"])
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
  });

});
