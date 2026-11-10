/**
 * ADR-0038 4단계 샌드박스 — 기수 생성 「시트 없이」 → 본인 클레임 → 관리자 명단 작업(팀·담당·정렬·삭제)이
 * 명단 시트를 한 번도 쓰지 않고 DB 명단만으로 끝나는지 실제 SQL(PGlite)로 확인한다. 합성 이름·이메일만.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  db: null as unknown as import("@electric-sql/pglite").PGlite,
  sheetRows: [] as string[][],
  sheetWrites: 0,
}));
vi.mock("pg", () => {
  class Pool {
    query = query;
    async connect() { return { query, release() {} }; }
    on() { return this; }
    async end() {}
  }
  return { Pool, default: { Pool } };
});
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("@/repo/db/trainer-recruitment", () => ({ listTrainerQualifications: async () => [] }));
vi.mock("@/config", async (orig) => ({
  ...(await orig<object>()),
  registry: () => ({ spreadsheetId: "reg-sheet", tab: "users" }),
  adminEmails: () => [],
  adminNames: () => ({}),
}));
// 명단 시트: 읽기는 fx.sheetRows, 쓰기는 횟수만 센다(0 이어야 통과).
vi.mock("@/repo/sheets-client", () => {
  const write = async () => { fx.sheetWrites += 1; return { data: {} }; };
  return {
    readRange: async () => fx.sheetRows,
    appendRows: write,
    ensureGridColumns: async () => {},
    sheetsClient: () => ({
      spreadsheets: { values: { update: write, batchUpdate: write, append: write, get: async () => ({ data: { values: [] } }) }, batchUpdate: write, get: async () => ({ data: { sheets: [] } }) },
    }),
  };
});
async function query(sql: string | { text: string; values?: unknown[] }, params: unknown[] = []) {
  if (typeof sql !== "string") { params = sql.values ?? []; sql = sql.text; }
  const r = params.length ? await fx.db.query(sql, params) : await fx.db.exec(sql).then((rs) => rs[rs.length - 1] ?? { rows: [], affectedRows: 0 });
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
}

import { createSheetlessMembers, sheetlessCreateBlocker } from "@/service/cohort-create-sheetless";
import { claimRegistry } from "@/repo/users-claim";
import { deleteUserByEmail, findUserByEmail, setTraineeAssignments, setTraineeTeam, setUserSortOrders } from "@/repo/users";
import { isSheetlessTenantKey } from "@/util/tenant-key";

const DATES = { courseStartISO: "2026-12-04", graduationISO: "2027-02-27" };
const row = async (email: string) =>
  (await fx.db.query<Record<string, string | number>>("select * from users where email = $1", [email])).rows;

beforeAll(async () => {
  process.env.REGISTRY_DB_READ = "1";
  process.env.DATABASE_URL = "postgres://synthetic.invalid/sandbox";
  fx.db = new PGlite();
  await fx.db.exec(readFileSync("lib/repo/db/migrations/0001_users_cohorts.sql", "utf8"));
  await fx.db.exec(readFileSync("lib/repo/db/migrations/0002_users_natural_key.sql", "utf8"));
  // 시트 정본 수강생 1명(명단 시트·DB 둘 다) + 같은 기수의 시트 사전등록 행(이름 「시트사전」).
  await fx.db.exec(`insert into users(id,email,cohort,name,spreadsheet_id) values
    ('00000000-0000-4000-8000-000000000001','old@example.test','12','합성기존','1SyntheticSheet'),
    ('00000000-0000-4000-8000-000000000002','','12','시트사전','')`);
  fx.sheetRows = [
    ["old@example.test", "12", "합성기존", "1SyntheticSheet", "trainee", "active"],
    ["", "12", "시트사전", "", "trainee", "active"],
  ];
}, 60000);
afterAll(async () => {
  delete process.env.REGISTRY_DB_READ;
  delete process.env.DATABASE_URL;
  await fx.db?.close();
});

describe("시트 없이 기수 만들기", () => {
  it("쓸 수 없는 경우를 막는다 — 아레나·시트 정본 기수·날짜 없음", () => {
    expect(sheetlessCreateBlocker({ label: "A3", type: "arena", ...DATES })).toMatch(/아레나/);
    expect(sheetlessCreateBlocker({ label: "5", type: "cohort", ...DATES })).toMatch(/시트 정본/);
    expect(sheetlessCreateBlocker({ label: "12", type: "cohort", courseStartISO: "", graduationISO: "" })).toMatch(/수강 시작일/);
    expect(sheetlessCreateBlocker({ label: "12", type: "cohort", ...DATES })).toBeNull();
  });

  it("DB 명단에 사전등록 행만 만들고, 이미 명단에 있는 이름·중복 이름은 건너뛴다", async () => {
    const r = await createSheetlessMembers({ label: "12", ...DATES }, ["합성갑", "합성을", "합성갑", "시트사전", "합성기존"]);
    expect(r.created.map((c) => c.name)).toEqual(["합성갑", "합성을"]);
    expect(r.skipped.map((s) => s.name)).toEqual(["합성갑", "시트사전", "합성기존"]);
    expect(r.created.every((c) => isSheetlessTenantKey(c.sheetId))).toBe(true);
    const prep = (await fx.db.query<Record<string, string>>("select * from users where name = '합성갑'")).rows[0]!;
    expect(prep).toMatchObject({ email: "", cohort: "12", course_start_iso: DATES.courseStartISO, graduation_iso: DATES.graduationISO });
    expect(fx.sheetWrites).toBe(0);
  });
});

describe("본인 클레임 → 관리자 명단 작업 (시트 쓰기 0)", () => {
  it("사전등록 행에 이메일이 채워지고 로그인 조회가 된다(다시 해도 그대로)", async () => {
    await claimRegistry("gap@example.test", "12", "합성갑", "", "trainee", "active");
    await claimRegistry("gap@example.test", "12", "합성갑", "", "trainee", "active");
    const u = await findUserByEmail("gap@example.test", { fresh: true });
    expect(isSheetlessTenantKey(u!.spreadsheetId)).toBe(true);
    expect(u!.courseStartISO).toBe(DATES.courseStartISO);
    expect((await fx.db.query("select 1 from users where name = '합성갑'")).rows).toHaveLength(1);
  });

  it("같은 번호를 다른 이메일(직원)이 쓰면 같은 번호로 한 줄 더", async () => {
    await claimRegistry("staff@example.test", "12", "합성갑", "", "trainee", "active");
    const a = await findUserByEmail("gap@example.test", { fresh: true });
    const b = await findUserByEmail("staff@example.test", { fresh: true });
    expect(b!.spreadsheetId).toBe(a!.spreadsheetId);
  });

  it("팀·담당 트레이너·정렬이 DB 명단에 저장된다", async () => {
    await setTraineeTeam("gap@example.test", " A팀 ");
    await setTraineeAssignments("gap@example.test", ["Trainer@Example.test"]);
    const r = await setUserSortOrders([{ email: "gap@example.test", sortOrder: 3 }]);
    expect(r.updated).toBe(1);
    expect((await row("gap@example.test"))[0]).toMatchObject({ team: "A팀", assigned_trainer: "trainer@example.test", sort_order: 3 });
  });

  it("삭제하면 DB 명단에서만 지워지고, 시트 수강생은 그대로", async () => {
    await deleteUserByEmail("staff@example.test");
    expect(await row("staff@example.test")).toHaveLength(0);
    expect(await row("old@example.test")).toHaveLength(1);
    expect(fx.sheetWrites).toBe(0);
  });

  it("시트 명단에 있는 수강생 작업은 예전처럼 시트로 간다(경로 불변)", async () => {
    await setTraineeTeam("old@example.test", "B팀");
    expect(fx.sheetWrites).toBe(1);
  });
});
