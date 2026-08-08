/**
 * lib/repo/db/course-dates.ts 단위 회귀 (BBE-57).
 * 고정하는 계약:
 *   ① DATABASE_URL 미설정(dbEnabled=false) = 전면 no-op — 비파일럿·미배선 상태 불변.
 *   ② readCourseDatesFromDb = spreadsheet_id 조회, course_start_iso<>'' 가드, updated_at desc 1건.
 *      쿼리 실패는 throw 아니라 null(시트 폴백 유지 — 적대적 리뷰 HIGH 수정, 2026-08-08).
 *   ③ writeCourseDatesToDb = UPDATE-only(INSERT 없음) — (email,cohort) WHERE, 별도 쓰기 게이트
 *      (courseDateDbWriteEnabled, dbEnabled() 만으론 부족 — 적대적 리뷰 MEDIUM 수정).
 *      gradISO 빈값은 기존 graduation_iso 보존(덮어써 지우지 않음 — 적대적 리뷰 LOW 수정).
 *   ④ courseDateDbReadEnabled/courseDateDbWriteEnabled = dbEnabled() && 각자 전용 env==="1" — 기본 OFF.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const query = vi.fn();
const getDbPool = vi.fn(() => ({ query }));

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  getDbPool: (...a: unknown[]) => getDbPool(...(a as [])),
}));

import {
  courseDateDbReadEnabled,
  courseDateDbWriteEnabled,
  readCourseDatesFromDb,
  writeCourseDatesToDb,
} from "@/repo/db/course-dates";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  getDbPool.mockReset().mockReturnValue({ query });
  process.env.COURSE_DATE_DB_WRITE = "1"; // 쓰기 테스트 기본값 — 게이트 자체 테스트는 아래 별도 describe
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("DATABASE_URL 미설정 = 전면 no-op", () => {
  beforeEach(() => dbEnabled.mockReturnValue(false));

  it("readCourseDatesFromDb → null, 쿼리 0회", async () => {
    expect(await readCourseDatesFromDb("sheet-1")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("writeCourseDatesToDb → skipped:true, 쿼리 0회", async () => {
    const r = await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "2026-07-21");
    expect(r).toEqual({ skipped: true, updated: false });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("readCourseDatesFromDb — spreadsheet_id 조회", () => {
  it("spreadsheetId 빈 문자열 → null, 쿼리 0회", async () => {
    expect(await readCourseDatesFromDb("")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("행 없음 → null", async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await readCourseDatesFromDb("sheet-1")).toBeNull();
  });

  it("행 있음 → courseStartISO/graduationISO 매핑, SQL 이 course_start_iso<>'' 가드·updated_at desc 포함", async () => {
    query.mockResolvedValue({
      rows: [{ course_start_iso: "2026-06-01", graduation_iso: "2026-07-21" }],
    });
    const result = await readCourseDatesFromDb("sheet-1");
    expect(result).toEqual({ courseStartISO: "2026-06-01", graduationISO: "2026-07-21" });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/where spreadsheet_id = \$1 and course_start_iso <> ''/i);
    expect(sql).toMatch(/order by updated_at desc limit 1/i);
    expect(params).toEqual(["sheet-1"]);
  });

  it("부부·멀티계정 공유 spreadsheetId — 여러 행 중에서도 값 있는 1건만 반환(집계 대상 아님)", async () => {
    // 실제 SQL 이 limit 1 이므로 DB 가 여러 행을 갖고 있어도 애플리케이션 레벨 병합 불필요 —
    // 이 테스트는 응답 shape 만 고정(다건 반환 방지 회귀).
    query.mockResolvedValue({
      rows: [{ course_start_iso: "2026-06-01", graduation_iso: "2026-07-21" }],
    });
    const result = await readCourseDatesFromDb("shared-sheet");
    expect(Array.isArray(result)).toBe(false);
  });

  it("🚨 DB 쿼리 실패(커넥션 끊김 등) → throw 안 함, null 반환(시트 폴백 유지 — 적대적 리뷰 HIGH)", async () => {
    query.mockRejectedValue(new Error("connection terminated"));
    await expect(readCourseDatesFromDb("sheet-1")).resolves.toBeNull();
  });
});

describe("writeCourseDatesToDb — UPDATE-only(INSERT 없음), 게이트 ON 상태", () => {
  it("email/cohort/startISO 중 하나라도 빈값 → skipped:true, 쿼리 0회", async () => {
    expect(await writeCourseDatesToDb("", "8", "2026-06-01", "")).toEqual({ skipped: true, updated: false });
    expect(await writeCourseDatesToDb("a@b.com", "", "2026-06-01", "")).toEqual({ skipped: true, updated: false });
    expect(await writeCourseDatesToDb("a@b.com", "8", "", "")).toEqual({ skipped: true, updated: false });
    expect(query).not.toHaveBeenCalled();
  });

  it("정상 입력 → SQL 이 update(email=$1 and cohort=$2), INSERT/ON CONFLICT 없음", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "2026-07-21");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/^\s*update users set/i);
    expect(sql).not.toMatch(/insert into|on conflict/i);
    expect(sql).toMatch(/where email = \$1 and cohort = \$2/i);
    expect(params).toEqual(["a@b.com", "8", "2026-06-01", "2026-07-21"]);
  });

  it("rowCount=0(users 행 아직 없음 — BBE-55 머지 전) → skipped:false, updated:false(throw 안 함)", async () => {
    query.mockResolvedValue({ rowCount: 0 });
    const r = await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "2026-07-21");
    expect(r).toEqual({ skipped: false, updated: false });
  });

  it("rowCount=1 → updated:true", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    const r = await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "2026-07-21");
    expect(r).toEqual({ skipped: false, updated: true });
  });

  it("gradISO 빈값이어도 startISO 만 있으면 진행(종강일 미확정 상태 허용)", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    const r = await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "");
    expect(r.skipped).toBe(false);
  });

  it("🚨 gradISO 빈값 → SQL 이 graduation_iso 를 빈값으로 덮지 않고 기존값 보존(CASE WHEN) — 적대적 리뷰 LOW", async () => {
    query.mockResolvedValue({ rowCount: 1 });
    await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/graduation_iso = case when \$4 = '' then graduation_iso else \$4 end/i);
    expect(params).toEqual(["a@b.com", "8", "2026-06-01", ""]);
  });
});

describe("writeCourseDatesToDb — 쓰기 게이트 OFF(COURSE_DATE_DB_WRITE 미설정) → 전면 no-op", () => {
  beforeEach(() => {
    delete process.env.COURSE_DATE_DB_WRITE;
  });

  it("dbEnabled=true 여도 쓰기 게이트 꺼져 있으면 skipped:true, 쿼리 0회 — 적대적 리뷰 MEDIUM 수정", async () => {
    const r = await writeCourseDatesToDb("a@b.com", "8", "2026-06-01", "2026-07-21");
    expect(r).toEqual({ skipped: true, updated: false });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("courseDateDbReadEnabled — 전역 카나리아 게이트(읽기)", () => {
  it("dbEnabled=false → false(env 무관)", () => {
    dbEnabled.mockReturnValue(false);
    process.env.COURSE_DATE_DB_READ = "1";
    expect(courseDateDbReadEnabled()).toBe(false);
  });

  it("dbEnabled=true 이지만 env 미설정 → false(기본 OFF)", () => {
    dbEnabled.mockReturnValue(true);
    delete process.env.COURSE_DATE_DB_READ;
    expect(courseDateDbReadEnabled()).toBe(false);
  });

  it("dbEnabled=true && COURSE_DATE_DB_READ=1 → true", () => {
    dbEnabled.mockReturnValue(true);
    process.env.COURSE_DATE_DB_READ = "1";
    expect(courseDateDbReadEnabled()).toBe(true);
  });

  it("COURSE_DATE_DB_READ=true(문자열) 는 켜지지 않는다 — 정확히 \"1\"만", () => {
    dbEnabled.mockReturnValue(true);
    process.env.COURSE_DATE_DB_READ = "true";
    expect(courseDateDbReadEnabled()).toBe(false);
  });
});

describe("courseDateDbWriteEnabled — 전역 카나리아 게이트(쓰기, 읽기와 독립)", () => {
  it("dbEnabled=false → false(env 무관)", () => {
    dbEnabled.mockReturnValue(false);
    process.env.COURSE_DATE_DB_WRITE = "1";
    expect(courseDateDbWriteEnabled()).toBe(false);
  });

  it("dbEnabled=true 이지만 env 미설정 → false(기본 OFF)", () => {
    dbEnabled.mockReturnValue(true);
    delete process.env.COURSE_DATE_DB_WRITE;
    expect(courseDateDbWriteEnabled()).toBe(false);
  });

  it("dbEnabled=true && COURSE_DATE_DB_WRITE=1 → true", () => {
    dbEnabled.mockReturnValue(true);
    process.env.COURSE_DATE_DB_WRITE = "1";
    expect(courseDateDbWriteEnabled()).toBe(true);
  });

  it("읽기 게이트 ON 이어도 쓰기 게이트는 별도 — COURSE_DATE_DB_READ=1 만으로 쓰기가 켜지지 않는다", () => {
    dbEnabled.mockReturnValue(true);
    delete process.env.COURSE_DATE_DB_WRITE;
    process.env.COURSE_DATE_DB_READ = "1";
    expect(courseDateDbWriteEnabled()).toBe(false);
  });
});
