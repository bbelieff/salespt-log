/** 0022_schedule_notes + repo/service — 메모·주간 이슈 저장·읽기, 이상한 저장값은 빈 값. 가상 이메일만. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => holder.db }));

import { getScheduleNotes, saveScheduleNote } from "@/service/schedule-notes";
import { ScheduleNotePut } from "@/types";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync("lib/repo/db/migrations/0022_schedule_notes.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // 두 번 적용해도 안전
  holder.db = db;
}, 60000);
afterAll(async () => {
  await db?.close();
});

const days = ["2026-11-06", "2026-11-07", "2026-11-08"];
const issue = { id: "i1", text: "서류 회신 대기", urgent: true, done: false };

describe("일정 보드 메모·이슈", () => {
  it("저장한 적 없으면 빈 값", async () => {
    expect(await getScheduleNotes("a@example.test", days, "2026-11-06")).toEqual({ memos: {}, issues: [] });
  });

  it("메모는 날짜별, 이슈는 수강 주별 — 대소문자 무관, 다른 계정·다른 주는 섞이지 않는다", async () => {
    await saveScheduleNote("A@example.test", { kind: "memo", date: "2026-11-07", text: "주차 B2" });
    await saveScheduleNote("a@example.test", { kind: "issues", weekStart: "2026-11-06", issues: [issue] });
    expect(await getScheduleNotes("a@example.test", days, "2026-11-06")).toEqual({ memos: { "2026-11-07": "주차 B2" }, issues: [issue] });
    expect(await getScheduleNotes("a@example.test", days, "2026-11-13")).toEqual({ memos: { "2026-11-07": "주차 B2" }, issues: [] });
    expect(await getScheduleNotes("b@example.test", days, "2026-11-06")).toEqual({ memos: {}, issues: [] });
  });

  it("빈 메모로 덮으면 그 날짜는 빠진다", async () => {
    await saveScheduleNote("a@example.test", { kind: "memo", date: "2026-11-07", text: "" });
    expect((await getScheduleNotes("a@example.test", days, "2026-11-06")).memos).toEqual({});
  });

  it("손상된 저장값은 빈 값으로 읽는다", async () => {
    await db.query("insert into public.schedule_notes (email, note_key, body) values ('c@example.test','issues:2026-11-06','{\"x\":1}'), ('c@example.test','memo:2026-11-06','42')");
    expect(await getScheduleNotes("c@example.test", days, "2026-11-06")).toEqual({ memos: {}, issues: [] });
  });

  it("API 본문 검사 — 빈 이슈 글자·잘못된 날짜·51개 이상은 거절", () => {
    expect(ScheduleNotePut.safeParse({ kind: "issues", weekStart: "2026-11-06", issues: [{ ...issue, text: "  " }] }).success).toBe(false);
    expect(ScheduleNotePut.safeParse({ kind: "memo", date: "2026-11-6", text: "x" }).success).toBe(false);
    expect(ScheduleNotePut.safeParse({ kind: "issues", weekStart: "2026-11-06", issues: Array.from({ length: 51 }, (_, i) => ({ ...issue, id: `i${i}` })) }).success).toBe(false);
    expect(ScheduleNotePut.safeParse({ kind: "memo", date: "2026-11-06", text: "" }).success).toBe(true);
  });
});
