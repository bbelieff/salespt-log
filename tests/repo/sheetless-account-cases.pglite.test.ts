/**
 * ADR-0038 샌드박스 — 계정 케이스별로 「누구의 기록 통인가」가 올바로 정해지는지 실제 SQL 로 확인한다.
 * 운영 DB·네트워크·실명 없음(합성 이메일·합성 번호만).
 *
 * 케이스 표(docs/plans/active/sheetless-student-id.md §2 와 같은 번호):
 *  A 기존 시트 수강생 · B 시트 없는 새 수강생 · C 한 번호를 여러 이메일이 공유 ·
 *  D 숫자기수 + 아레나 재참여 · E 트레이너(번호 없음) · F 준비행(이메일 빈칸) ·
 *  I 시트 없는 수강생 둘의 기록 분리 · X 빈 번호("")끼리 섞이는 위험(금지 근거)
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput } from "@/types/db-sheet";

const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => true,
  getDbPool: () => ({ query, connect: async () => ({ query, release() {} }) }),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, revalidateTag: () => {} }));
vi.mock("@/repo/db/trainer-recruitment", () => ({ listTrainerQualifications: async () => [] }));
async function query(sql: string, params: unknown[] = []) {
  const r = await fixture.db!.query(sql, params);
  return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
}

import { findUserByEmail } from "@/repo/users";
import { listDbSheet, saveDbSheetLead } from "@/repo/db/db-sheet";
import { hasRealSheet, isUsableTenantKey, newSheetlessTenantKey } from "@/util/tenant-key";

const SHEET_A = "1SyntheticSheetA_abcdefghijklmnopqrstuvwxyz0";
const SHEET_D = "1SyntheticSheetD_abcdefghijklmnopqrstuvwxyz0";
const LOCAL_B = newSheetlessTenantKey("11111111-1111-4111-8111-111111111111");
const LOCAL_I = newSheetlessTenantKey("22222222-2222-4222-8222-222222222222");

async function addUser(email: string, cohort: string, name: string, spreadsheetId: string, role = "trainee") {
  await query(
    "insert into users(id,email,cohort,name,spreadsheet_id,role) values($1,$2,$3,$4,$5,$6)",
    [randomUUID(), email, cohort, name, spreadsheetId, role],
  );
}
let serial = 0;
const lead = () =>
  DbSheetLeadInput.parse({
    id: randomUUID(),
    date: "2026-11-10",
    channel: "직접생산",
    company: `합성업체 ${++serial}`,
    phone: `0101111${String(serial).padStart(4, "0")}`,
    memo: "",
  });

beforeAll(async () => {
  process.env.REGISTRY_DB_READ = "1";
  fixture.db = new PGlite();
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0001_users_cohorts.sql", "utf8"));
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0002_users_natural_key.sql", "utf8"));
  await fixture.db.exec(
    "create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));",
  );
  await fixture.db.exec(readFileSync("lib/repo/db/migrations/0008_db_sheet.sql", "utf8"));
  await addUser("a@example.test", "0", "합성A", SHEET_A);
  await addUser("b@example.test", "0", "합성B", LOCAL_B);
  await addUser("c1@example.test", "0", "합성C", LOCAL_B); // 케이스 C: B 의 번호를 직원이 공유
  await addUser("d@example.test", "0", "합성D", SHEET_D);
  await addUser("d@example.test", "A9-1", "합성D", LOCAL_I.replace("2222", "3333"));
  await addUser("t@example.test", "T", "합성트레이너", "", "trainer");
  await addUser("", "0", "합성준비", "");
  await addUser("i@example.test", "0", "합성I", LOCAL_I);
}, 60000);
afterAll(async () => {
  delete process.env.REGISTRY_DB_READ;
  await fixture.db?.close();
});

describe("계정 케이스별 고유 번호 해석", () => {
  it("A 기존 시트 수강생 — 시트 번호 그대로, 시트 있음", async () => {
    const u = await findUserByEmail("a@example.test", { fresh: true });
    expect(u?.spreadsheetId).toBe(SHEET_A);
    expect(hasRealSheet(u?.spreadsheetId)).toBe(true);
  });

  it("B 시트 없는 새 수강생 — local: 번호로 로그인 해석, 시트 없음", async () => {
    const u = await findUserByEmail("B@EXAMPLE.TEST", { fresh: true });
    expect(u?.spreadsheetId).toBe(LOCAL_B);
    expect(hasRealSheet(u?.spreadsheetId)).toBe(false);
    expect(isUsableTenantKey(u?.spreadsheetId)).toBe(true);
  });

  it("C 한 번호를 여러 이메일이 공유 — 같은 기록 통", async () => {
    const owner = await findUserByEmail("b@example.test", { fresh: true });
    const staff = await findUserByEmail("c1@example.test", { fresh: true });
    expect(staff?.spreadsheetId).toBe(owner?.spreadsheetId);
  });

  it("D 숫자기수 + 아레나 재참여 — 아레나 행이 우선(기존 규칙 유지), 번호가 섞이지 않음", async () => {
    const u = await findUserByEmail("d@example.test", { fresh: true });
    expect(u?.cohort).toBe("A9-1");
    expect(u?.spreadsheetId).not.toBe(SHEET_D);
    expect(isUsableTenantKey(u?.spreadsheetId)).toBe(true);
  });

  it("E 트레이너 — 번호 없음(\"\") 그대로, 수강생 기록 통이 아님", async () => {
    const u = await findUserByEmail("t@example.test", { fresh: true });
    expect(u?.role).toBe("trainer");
    expect(isUsableTenantKey(u?.spreadsheetId)).toBe(false);
  });

  it("F 준비행(이메일 빈칸) — 어떤 로그인에도 잡히지 않는다", async () => {
    expect(await findUserByEmail("", { fresh: true })).toBeNull();
  });
});

describe("기록 분리", () => {
  it("I 시트 없는 수강생 둘의 기록은 서로 보이지 않는다", async () => {
    const b = { spreadsheetId: LOCAL_B, cohort: "0", email: "b@example.test" };
    const i = { spreadsheetId: LOCAL_I, cohort: "0", email: "i@example.test" };
    await saveDbSheetLead(b, lead(), null);
    await saveDbSheetLead(i, lead(), null);
    expect(await listDbSheet(b)).toHaveLength(1);
    expect(await listDbSheet(i)).toHaveLength(1);
    expect((await listDbSheet(b))[0]!.company).not.toBe((await listDbSheet(i))[0]!.company);
  });

  it("X 빈 번호(\"\")를 쓰면 서로 다른 사람의 기록이 한 통에 섞인다 — 그래서 금지한다", async () => {
    // DB관리 저장소는 이미 빈 번호를 거절한다.
    const p = { spreadsheetId: "", cohort: "0", email: "p@example.test" };
    await expect(saveDbSheetLead(p, lead(), null)).rejects.toThrow("Tenant required");
    // 하지만 일지·미팅·계약을 담는 sheet_rows 는 (번호, 탭, 행키) 로만 나눈다 —
    // 빈 번호 둘이 같은 날 같은 채널을 쓰면 한 행을 덮어쓴다(#798 을 그대로 병합하면 생길 사고).
    const upsert = "insert into sheet_rows(cohort,email,spreadsheet_id,tab,row_key,payload) values('0',$1,'','sales','2026-11-10:직접생산',$2::jsonb) on conflict(spreadsheet_id,tab,row_key) do update set email=excluded.email,payload=excluded.payload";
    await query(upsert, ["p@example.test", JSON.stringify({ contact: 3 })]);
    await query(upsert, ["q@example.test", JSON.stringify({ contact: 1 })]);
    const r = await query("select email from sheet_rows where spreadsheet_id='' and tab='sales'");
    expect(r.rows).toEqual([{ email: "q@example.test" }]); // p 의 기록이 사라졌다
    expect(isUsableTenantKey("")).toBe(false);
  });
});
