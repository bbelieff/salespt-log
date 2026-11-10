/** ADR-0038 3단계 — 0020 합성 시험 수강생 마이그레이션: 1행만, 0기 날짜 복사, 다시 돌려도 그대로. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isSheetlessTenantKey } from "@/util/tenant-key";

const SQL = readFileSync("lib/repo/db/migrations/0020_sheetless_pilot_student.sql", "utf8");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("lib/repo/db/migrations/0001_users_cohorts.sql", "utf8"));
  await db.exec(readFileSync("lib/repo/db/migrations/0002_users_natural_key.sql", "utf8"));
  await db.exec(`insert into users(id,email,cohort,name,spreadsheet_id,course_start_iso,graduation_iso)
    values ('00000000-0000-4000-8000-000000000001','gm@example.test','0','합성GM','1SyntheticSheet','2026-01-05','2026-03-28'),
           ('00000000-0000-4000-8000-000000000002','x@example.test','7','합성7','1OtherSheet','2025-01-01','2025-02-20')`);
}, 60000);
afterAll(async () => { await db?.close(); });

describe("0020 시트 없는 합성 수강생", () => {
  it("0기에 local: 번호로 1명만 넣고, 0기 날짜를 복사한다", async () => {
    await db.exec(SQL);
    const r = await db.query<{ cohort: string; spreadsheet_id: string; course_start_iso: string; graduation_iso: string; role: string }>(
      "select cohort, spreadsheet_id, course_start_iso, graduation_iso, role from users where email = 'sheetless-pilot@salesptlog.invalid'",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ cohort: "0", role: "trainee", course_start_iso: "2026-01-05", graduation_iso: "2026-03-28" });
    expect(isSheetlessTenantKey(r.rows[0]!.spreadsheet_id)).toBe(true);
  });

  it("다시 돌려도 행이 늘지 않고 다른 행은 그대로다", async () => {
    await db.exec(SQL);
    const n = await db.query<{ n: number }>("select count(*)::int as n from users");
    expect(n.rows[0]!.n).toBe(3);
  });
});
