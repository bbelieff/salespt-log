/**
 * 레지스트리 읽기 DB 전환 게이트 (BBE-56) 단위 회귀.
 *
 * 고정하는 계약:
 *   ① 기본 OFF — `REGISTRY_DB_READ` 없으면 DB 를 아예 조회하지 않는다(동작 변화 0).
 *   ② DB 오류 → null(= 시트 폴백). 절대 throw 하지 않는다.
 *   ③ **DB 0행 → null(= 시트 폴백)**. "레지스트리가 0명"은 정상일 수 없다 —
 *      마이그레이션·backfill 미적용 상태에서 전 사용자 로그인 불가가 되는 것을 막는 핵심 가드
 *      (BBE-85 미완 상태에서 실재하는 시나리오).
 *   ④ 반환 행은 **시트 열 순서**(users A~T · cohorts A~J) — parseRow 가 그대로 먹는다.
 *   ⑤ null 컬럼은 ""(빈 문자열) — 시트 빈 칸과 같은 표현.
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
  readCohortRowsFromDb,
  readUserRowsFromDb,
  registryDbReadEnabled,
} from "@/repo/db/registry-read";

const ORIGINAL_FLAG = process.env.REGISTRY_DB_READ;

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  query.mockReset().mockResolvedValue({ rows: [] });
  getDbPool.mockReset().mockReturnValue({ query });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.REGISTRY_DB_READ = "1";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_FLAG === undefined) delete process.env.REGISTRY_DB_READ;
  else process.env.REGISTRY_DB_READ = ORIGINAL_FLAG;
});

describe("게이트 — 기본 OFF(동작 변화 0)", () => {
  it("env 미설정이면 DB 를 조회하지 않고 null", async () => {
    delete process.env.REGISTRY_DB_READ;
    expect(registryDbReadEnabled()).toBe(false);
    expect(await readUserRowsFromDb()).toBeNull();
    expect(await readCohortRowsFromDb()).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('"1" 이 아닌 값은 켜지지 않는다(오타·true 방어)', async () => {
    for (const v of ["0", "true", "yes", ""]) {
      process.env.REGISTRY_DB_READ = v;
      expect(registryDbReadEnabled()).toBe(false);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it("DATABASE_URL 이 없으면 env 를 켜도 조회하지 않는다", async () => {
    dbEnabled.mockReturnValue(false);
    expect(registryDbReadEnabled()).toBe(false);
    expect(await readUserRowsFromDb()).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("폴백 — 시트로 되돌아가는 조건", () => {
  it("DB 오류 시 throw 하지 않고 null", async () => {
    query.mockRejectedValue(new Error('relation "users" does not exist'));
    expect(await readUserRowsFromDb()).toBeNull();
  });

  it("🚨 0행이면 null — 빈 테이블을 읽어 전원 로그인 불가가 되는 것을 막는다", async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await readUserRowsFromDb()).toBeNull();
    expect(await readCohortRowsFromDb()).toBeNull();
  });

  it("오류 메시지의 접속 문자열은 로그에서 가려진다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    query.mockRejectedValue(new Error("fail postgresql://u:pw@host/db"));
    await readUserRowsFromDb();
    const logged = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(logged).toContain("[DATABASE_URL]");
    expect(logged).not.toContain("pw@host");
  });
});

describe("행 모양 — 시트 열 순서로 되돌린다", () => {
  it("users 는 A~T 20열, null 은 빈 문자열", async () => {
    query.mockResolvedValue({
      rows: [{
        email: "a@b.com", cohort: "A2-7기", name: "홍길동", spreadsheet_id: "sid",
        role: "trainee", status: "active", assigned_trainer: "", team: "",
        cohort_label: "PRM 7기", name_label: "홍길동",
        course_start_iso: "2026-08-07", graduation_iso: "2026-09-26", sort_order: 3,
        drive_parent_path: null, feedback_folder_id: "ffid", drive_link_status: "ok",
        memo: "회장", captain_of: "A1-1", gcal_token: "", gcal_settings: "{}",
      }],
    });
    const rows = await readUserRowsFromDb();
    expect(rows).not.toBeNull();
    const r = rows![0]!;
    expect(r).toHaveLength(20);
    expect(r[0]).toBe("a@b.com"); // A email
    expect(r[2]).toBe("홍길동"); // C name
    expect(r[5]).toBe("active"); // F status
    expect(r[12]).toBe("3"); // M sort_order — 시트처럼 문자열
    expect(r[13]).toBe(""); // N null → 빈 문자열
    expect(r[16]).toBe("회장"); // Q memo
    expect(r[17]).toBe("A1-1"); // R captain_of
    expect(r[19]).toBe("{}"); // T gcal_settings
  });

  it("cohorts 는 A~J 10열", async () => {
    query.mockResolvedValue({
      rows: [{
        label: "A2", status: "active", note: "", type: "arena",
        template_sheet_id: "", root_folder_id: "", roster_sheet_id: "",
        sheets_folder_id: "", company_parent_folder_id: "", season_start_iso: "2026-08-07",
      }],
    });
    const rows = await readCohortRowsFromDb();
    const r = rows![0]!;
    expect(r).toHaveLength(10);
    expect(r[0]).toBe("A2");
    expect(r[3]).toBe("arena");
    expect(r[9]).toBe("2026-08-07");
  });
});
