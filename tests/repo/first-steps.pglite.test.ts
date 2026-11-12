/** 0021_first_steps + repo/service — 계정마다 한 줄, 이상한 저장값은 빈 기억, 관리 화면 진행 수. 가상 이메일만. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => holder.db }));

import { getFirstSteps, listFirstStepsProgress, saveFirstSteps } from "@/service/first-steps";
import { FirstStepsState } from "@/types";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync("lib/repo/db/migrations/0021_first_steps.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // 두 번 적용해도 안전
  holder.db = db;
}, 60000);
afterAll(async () => {
  await db?.close();
});

const memory = { hidden: false, never: [], finished: [], reviewSeen: false, started: false };

describe("첫걸음 계정별 기억", () => {
  it("저장한 적 없으면 null", async () => {
    expect(await getFirstSteps("a@example.test")).toBeNull();
  });

  it("저장하면 다음에 그대로(대소문자 무관), 다른 계정은 그대로", async () => {
    await saveFirstSteps("A@example.test", { memory: { ...memory, never: ["meeting"] }, done: ["purchase", "lead"] });
    expect(await getFirstSteps("a@example.test")).toEqual({ memory: { ...memory, never: ["meeting"] }, done: ["purchase", "lead"] });
    expect(await getFirstSteps("b@example.test")).toBeNull();
  });

  it("관리 화면 진행 = 이메일별 끝낸 단계 수", async () => {
    await saveFirstSteps("b@example.test", { memory, done: ["purchase", "lead", "contact"] });
    expect(await listFirstStepsProgress()).toEqual({ byEmail: { "a@example.test": 2, "b@example.test": 3 }, total: 7 });
  });

  it("숨긴 수강생은 관리 화면 진행에서 빠진다", async () => {
    await saveFirstSteps("d@example.test", { memory: { ...memory, hidden: true, started: true }, done: ["purchase"] });
    expect((await listFirstStepsProgress()).byEmail["d@example.test"]).toBeUndefined();
  });

  it("손상된 저장값은 빈 기억으로 읽고 모르는 단계는 버린다", async () => {
    await db.query("insert into public.first_steps (email, memory, done) values ('c@example.test', '{\"hidden\":\"yes\"}', '{lead,unknown}')");
    expect(await getFirstSteps("c@example.test")).toEqual({ memory, done: ["lead"] });
  });

  it("API 본문 검사는 모르는 안내·단계를 거절한다", () => {
    expect(FirstStepsState.safeParse({ memory: { ...memory, never: ["nope"] }, done: [] }).success).toBe(false);
    expect(FirstStepsState.safeParse({ memory, done: ["lead", "x"] }).success).toBe(false);
    expect(FirstStepsState.safeParse({ memory, done: ["lead"] }).success).toBe(true);
  });
});
