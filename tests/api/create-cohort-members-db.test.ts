/**
 * POST /api/admin/create-cohort-members — BBE-70(R7-#21) DB-only 재작성 회귀.
 *
 * 구 라우트(Drive 복사+O1/O2 시트 기록)를 대체한 새 구현의 계약을 고정한다:
 *  ① dbEnabled=false → 503(폴백 없음, ADR-0030 §2)
 *  ② 기존 (cohort,name) 이 있으면 skip(멱등) — DB 재조회는 하지만 재생성은 안 함
 *  ③ 신규는 email="" 상태 upsert(self-claim 대기, 기존 prep-row 의미 유지)
 *  ④ 응답의 pending·dates 는 항상 빈 배열(이 흐름엔 존재하지 않는 개념)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSessionEmail: vi.fn(),
  isAdminEmail: vi.fn(),
  revalidateAdminPages: vi.fn(),
  dbEnabled: vi.fn(),
  findUserByCohortName: vi.fn(),
  upsertUserRow: vi.fn(),
  upsertCohortCells: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getSessionEmail: api.getSessionEmail,
  isAdminEmail: api.isAdminEmail,
}));
vi.mock("@/auth/revalidate-admin", () => ({
  revalidateAdminPages: api.revalidateAdminPages,
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: api.dbEnabled }));
vi.mock("@/repo/db/registry", () => ({
  findUserByCohortName: api.findUserByCohortName,
  upsertUserRow: api.upsertUserRow,
  upsertCohortCells: api.upsertCohortCells,
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/admin/create-cohort-members/route";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/create-cohort-members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function post(body: Record<string, unknown>) {
  const res = await POST(request(body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/create-cohort-members (DB-only, BBE-70)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionEmail.mockResolvedValue("admin@example.com");
    api.isAdminEmail.mockReturnValue(true);
    api.dbEnabled.mockReturnValue(true);
    api.findUserByCohortName.mockResolvedValue(null);
    api.upsertUserRow.mockResolvedValue(undefined);
    api.upsertCohortCells.mockResolvedValue(undefined);
  });

  it("미인증 401 · 비admin 403", async () => {
    api.getSessionEmail.mockResolvedValue(null);
    expect((await post({ token: "10", members: [{ name: "김도연" }] })).status).toBe(401);

    api.getSessionEmail.mockResolvedValue("x@y.com");
    api.isAdminEmail.mockReturnValue(false);
    expect((await post({ token: "10", members: [{ name: "김도연" }] })).status).toBe(403);
  });

  it("★DB 미설정이면 503 — 이 흐름은 시트 폴백이 없다(ADR-0030 §2)", async () => {
    api.dbEnabled.mockReturnValue(false);
    const { status, body } = await post({ token: "10", members: [{ name: "김도연" }] });
    expect(status).toBe(503);
    expect(body.error).toBe("db_unavailable");
    expect(api.upsertCohortCells).not.toHaveBeenCalled();
  });

  it("잘못된 토큰 → 400", async () => {
    const { status, body } = await post({ token: "!!", members: [{ name: "김도연" }] });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_token");
  });

  it("멤버 0명 → 400", async () => {
    expect((await post({ token: "10", members: [] })).status).toBe(400);
  });

  it("멤버 100명 초과 → 400", async () => {
    const members = Array.from({ length: 101 }, (_, i) => ({ name: `학생${i}` }));
    const { status, body } = await post({ token: "10", members });
    expect(status).toBe(400);
    expect(body.error).toBe("too_many");
  });

  it("날짜 형식이 틀리면 400 — 아무것도 쓰지 않는다", async () => {
    const { status, body } = await post({
      token: "10", courseStartISO: "2026-13-45", members: [{ name: "김도연" }],
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_input");
    expect(api.upsertCohortCells).not.toHaveBeenCalled();
  });

  it("★신규 멤버 — 기수 upsert(부분) + email 빈 users 행 upsert(self-claim 대기)", async () => {
    const { status, body } = await post({
      token: "10", courseStartISO: "2026-08-07", members: [{ name: "김도연" }],
    });

    expect(status).toBe(200);
    expect(api.upsertCohortCells).toHaveBeenCalledWith("10", {
      type: "cohort",
      season_start_iso: "2026-08-07",
    });
    expect(api.upsertUserRow).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "", cohort: "10", name: "김도연", role: "trainee", status: "active",
        cohortLabel: "10기", nameLabel: "김도연",
        courseStartISO: "2026-08-07", graduationISO: "2026-09-26", // O1+50(ADR-0005)
      }),
    );
    expect(body.created).toEqual([{ name: "김도연" }]);
    expect(body.pending).toEqual([]);
    expect(body.dates).toEqual([]);
  });

  it("courseStartISO 미입력이면 기수 upsert 에 season_start_iso 를 안 보낸다(기존 값 보존)", async () => {
    await post({ token: "10", members: [{ name: "김도연" }] });
    expect(api.upsertCohortCells).toHaveBeenCalledWith("10", { type: "cohort" });
  });

  it("★이미 존재하는 (cohort,name) 은 skip — 재upsert 안 함(멱등)", async () => {
    api.findUserByCohortName.mockResolvedValue({ email: "a@b.com", cohort: "10", name: "김도연" });
    const { body } = await post({ token: "10", members: [{ name: "김도연" }] });
    expect(body.skipped).toEqual([{ name: "김도연" }]);
    expect(body.created).toEqual([]);
    expect(api.upsertUserRow).not.toHaveBeenCalled();
  });

  it("이름 빈 멤버는 fail — 나머지는 계속 처리(부분 실패 허용)", async () => {
    const { body } = await post({
      token: "10", members: [{ name: "  " }, { name: "김도연" }],
    });
    expect(body.failed).toEqual([{ name: "", reason: "이름 없음" }]);
    expect(body.created).toEqual([{ name: "김도연" }]);
  });

  it("한 명 DB 쓰기 실패해도 나머지는 계속 진행", async () => {
    api.upsertUserRow
      .mockRejectedValueOnce(new Error("DB_ERROR"))
      .mockResolvedValueOnce(undefined);
    const { body } = await post({
      token: "10", members: [{ name: "김도연" }, { name: "박준용" }],
    });
    expect(body.failed).toEqual([{ name: "김도연", reason: "DB_ERROR" }]);
    expect(body.created).toEqual([{ name: "박준용" }]);
  });

  it("아레나 토큰(a1) 도 동일하게 동작 — label/type/display 정확", async () => {
    const { body } = await post({ token: "a1", members: [{ name: "김도연" }] });
    expect(body.label).toBe("A1");
    expect(body.type).toBe("arena");
    expect(body.display).toBe("A1회");
    expect(api.upsertCohortCells).toHaveBeenCalledWith("A1", { type: "arena" });
  });
});
