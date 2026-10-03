/**
 * 레지스트리 users/cohorts DB 미러 (BBE-55) 단위 회귀.
 * 고정하는 계약:
 *   ① DATABASE_URL 미설정 = 전면 no-op(쿼리 0) — 비파일럿 환경 불변.
 *   ② upsert 자연키 = users(email,cohort,name) · cohorts(label) — 0002 마이그레이션과 일치.
 *      ON CONFLICT DO UPDATE 의 SET 절에 자연키 컬럼이 들어가면 안 된다(키 자기갱신 금지).
 *   ③ 삭제는 3컬럼 모두로 좁힌다 — email 만으로 지우면 같은 사람의 다른 기수 행까지 날아간다.
 *   ④ id 는 앱이 생성(uuid) — DB default 없음(BBE-54 관례).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const query = vi.fn();
// connect 는 트랜잭션(rekey) 테스트에서만 주입 — 기본은 단문 쿼리 경로.
const getDbPool = vi.fn((): { query: typeof query; connect?: unknown } => ({ query }));

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  getDbPool: (...a: unknown[]) => getDbPool(...(a as [])),
}));

import {
  deleteUserRow,
  findUserByCohortName,
  rekeyUserRow,
  upsertCohortCells,
  upsertUserCells,
  upsertUserRow,
  userColumnForLetter,
  cohortColumnForLetter,
} from "@/repo/db/registry";

const ROW = {
  email: "a@b.com", cohort: "A2-7기", name: "홍길동", spreadsheetId: "sheet-1",
  role: "trainee", status: "active", assignedTrainer: "", team: "",
  cohortLabel: "", nameLabel: "", courseStartISO: "", graduationISO: "", sortOrder: 0,
  driveParentPath: "", feedbackFolderId: "", driveLinkStatus: "",
  memo: "", captainOf: "", gcalToken: "", gcalSettings: "",
};

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  query.mockReset().mockResolvedValue({ rows: [] });
  getDbPool.mockReset().mockReturnValue({ query });
});

describe("DATABASE_URL 미설정 = 전면 no-op", () => {
  beforeEach(() => dbEnabled.mockReturnValue(false));

  it("upsert·delete 모두 쿼리를 보내지 않는다", async () => {
    await upsertUserRow(ROW);
    await upsertUserCells({ email: "a@b.com", cohort: "7", name: "홍" }, { memo: "회장" });
    await deleteUserRow({ email: "a@b.com", cohort: "7", name: "홍" });
    await upsertCohortCells("A2", { season_start_iso: "2026-08-07" });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("users upsert — 자연키 (email, cohort, name)", () => {
  it("전체 행 upsert 는 3컬럼 키로 충돌 판정한다", async () => {
    await upsertUserRow(ROW);
    const [sql] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("on conflict (email, cohort, name)");
  });

  it("SET 절이 자연키 컬럼을 갱신하지 않는다(키 자기갱신 금지)", async () => {
    await upsertUserRow(ROW);
    const [sql] = query.mock.calls[0] as [string, unknown[]];
    const setPart = sql.slice(sql.indexOf("do update set"));
    expect(setPart).not.toContain("email = excluded.email");
    expect(setPart).not.toContain("cohort = excluded.cohort");
    expect(setPart).not.toContain("name = excluded.name");
    // 비-키 컬럼은 정상 갱신.
    expect(setPart).toContain("memo = excluded.memo");
  });

  it("id 는 앱이 생성한 uuid 로 첫 파라미터에 실린다", async () => {
    await upsertUserRow(ROW);
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(String(params[0])).toMatch(/^[0-9a-f-]{36}$/);
    expect(params[1]).toBe("a@b.com");
  });

  it("부분 셀 upsert 는 키 3컬럼 + 지정 컬럼만 INSERT 한다", async () => {
    await upsertUserCells({ email: "a@b.com", cohort: "7", name: "홍" }, { memo: "회장" });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("insert into users (id, email, cohort, name, memo)");
    expect(params.slice(1)).toEqual(["a@b.com", "7", "홍", "회장"]);
  });

  it("빈 cells 는 쿼리를 보내지 않는다", async () => {
    await upsertUserCells({ email: "a@b.com", cohort: "7", name: "홍" }, {});
    expect(query).not.toHaveBeenCalled();
  });
});

describe("자연키 정규화 — 유령 행 방지(적대검증 BLOCKER 회귀)", () => {
  it("email 대소문자·앞뒤공백이 달라도 같은 키로 수렴한다", async () => {
    await upsertUserCells({ email: " A@B.com ", cohort: "7", name: "홍" }, { memo: "x" });
    await upsertUserCells({ email: "a@b.com", cohort: "7", name: "홍" }, { memo: "y" });
    const k1 = (query.mock.calls[0] as [string, unknown[]])[1].slice(1, 4);
    const k2 = (query.mock.calls[1] as [string, unknown[]])[1].slice(1, 4);
    expect(k1).toEqual(k2);
    expect(k1).toEqual(["a@b.com", "7", "홍"]);
  });

  it("cohort·name 의 앞뒤 공백도 정리된다(parseRow 가 A~H 를 trim 하지 않아 실재)", async () => {
    await upsertUserRow({ ...ROW, email: "A@B.com", cohort: " 7 ", name: "홍길동 " });
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params.slice(1, 4)).toEqual(["a@b.com", "7", "홍길동"]);
  });

  it("삭제도 같은 정규화를 거친다 — 대소문자 다른 유령만 지우는 사고 방지", async () => {
    await deleteUserRow({ email: "A@B.com ", cohort: " 7", name: " 홍 " });
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(["a@b.com", "7", "홍"]);
  });
});

describe("users delete — 같은 사람의 다른 기수 행을 지우지 않는다", () => {
  it("email·cohort·name 3조건으로 좁힌다", async () => {
    await deleteUserRow({ email: "a@b.com", cohort: "A2-7기", name: "홍길동" });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("where email = $1 and cohort = $2 and name = $3");
    expect(params).toEqual(["a@b.com", "A2-7기", "홍길동"]);
  });
});

describe("rekey — 자연키 변경은 한 트랜잭션", () => {
  it("begin → delete(옛키) → insert(새행) → commit 순서로 실행된다", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    getDbPool.mockReturnValue({ query, connect: vi.fn().mockResolvedValue(client) });
    await rekeyUserRow(
      { email: "OLD@b.com", cohort: "7", name: "홍" },
      { ...ROW, email: "new@b.com", cohort: "A2-7기", name: "홍" },
    );
    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toBe("begin");
    expect(sqls[1]).toContain("delete from users");
    expect(sqls[2]).toContain("insert into users");
    expect(sqls[3]).toBe("commit");
    // 옛 키도 정규화되어 삭제된다.
    expect((client.query.mock.calls[1] as [string, unknown[]])[1]).toEqual(["old@b.com", "7", "홍"]);
    expect(client.release).toHaveBeenCalled();
  });

  it("삽입이 실패하면 rollback — 삭제만 남는 반쪽 적용 금지", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // begin
        .mockResolvedValueOnce({ rows: [] }) // delete
        .mockRejectedValueOnce(new Error("insert 실패")) // insert
        .mockResolvedValue({ rows: [] }), // rollback
      release: vi.fn(),
    };
    getDbPool.mockReturnValue({ query, connect: vi.fn().mockResolvedValue(client) });
    await expect(rekeyUserRow({ email: "a@b.com", cohort: "7", name: "홍" }, ROW)).rejects.toThrow();
    expect(client.query.mock.calls.map((c) => String(c[0]))).toContain("rollback");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("findUserByCohortName — BBE-70 기수 생성 멱등 판정 조회", () => {
  it("DATABASE_URL 미설정이면 쿼리 없이 null(폴백 없음 — 호출부가 라우트 자체를 막는다)", async () => {
    dbEnabled.mockReturnValue(false);
    const r = await findUserByCohortName("8", "홍길동");
    expect(r).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("행이 없으면 null", async () => {
    query.mockResolvedValue({ rows: [] });
    const r = await findUserByCohortName("8", "홍길동");
    expect(r).toBeNull();
  });

  it("매칭 행을 RegistryUserRow 로 변환해 반환한다", async () => {
    query.mockResolvedValue({
      rows: [{
        email: "a@b.com", cohort: "8", name: "홍길동", spreadsheet_id: "",
        role: "trainee", status: "active", assigned_trainer: "", team: "",
        cohort_label: "8기", name_label: "홍길동", course_start_iso: "2026-08-10",
        graduation_iso: "2026-09-29", sort_order: 0, drive_parent_path: "",
        feedback_folder_id: "", drive_link_status: "", memo: "", captain_of: "",
        gcal_token: "", gcal_settings: "",
      }],
    });
    const r = await findUserByCohortName("8", "홍길동");
    expect(r).toMatchObject({ email: "a@b.com", cohort: "8", name: "홍길동", sortOrder: 0 });
  });

  it("cohort·name 을 trim 해 쿼리에 넘긴다", async () => {
    query.mockResolvedValue({ rows: [] });
    await findUserByCohortName(" 8 ", " 홍길동 ");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("where cohort = $1 and name = $2");
    expect(params).toEqual(["8", "홍길동"]);
  });
});

describe("cohorts upsert — 자연키 (label)", () => {
  it("label 충돌로 판정하고 SET 에 label 을 넣지 않는다", async () => {
    await upsertCohortCells("A2", { season_start_iso: "2026-08-07" });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("on conflict (label)");
    expect(sql.slice(sql.indexOf("do update set"))).not.toContain("label = excluded.label");
    expect(params.slice(1)).toEqual(["A2", "2026-08-07"]);
  });
});

describe("시트 열문자 → DB 컬럼 매핑 (A~T / A~J)", () => {
  it("users 주요 열이 스키마 컬럼명과 1:1", () => {
    expect(userColumnForLetter("A")).toBe("email");
    expect(userColumnForLetter("F")).toBe("status");
    expect(userColumnForLetter("Q")).toBe("memo");
    expect(userColumnForLetter("R")).toBe("captain_of");
    expect(userColumnForLetter("T")).toBe("gcal_settings");
  });

  it("cohorts 열이 스키마 컬럼명과 1:1", () => {
    expect(cohortColumnForLetter("B")).toBe("status");
    expect(cohortColumnForLetter("J")).toBe("season_start_iso");
  });

  it("모르는 열문자는 조용히 통과시키지 않고 throw", () => {
    expect(() => userColumnForLetter("Z")).toThrow(/알 수 없는 컬럼/);
    expect(() => cohortColumnForLetter("Z")).toThrow(/알 수 없는 컬럼/);
  });
});
