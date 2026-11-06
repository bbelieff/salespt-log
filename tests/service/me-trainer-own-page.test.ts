/**
 * 2026-11-06 belie 「박수혁 트레이너 0기 코스텝 클레임했는데 안 된다」 — 같은 메일에 수강생 행이 생기면
 * findUserByEmail 이 수강생 행을 골라 me.ownArenaSheetId 가 비어 수강생 토글이 안 보였다.
 * 활성 트레이너 자격이 있으면 그 수강생 시트로 토글을 띄운다. 가상 이메일·시트만.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  trainer: null as null | Record<string, unknown>,
}));
vi.mock("@/repo/users", () => ({ findUserByEmail: async () => m.user, findTrainerByEmail: async () => m.trainer }));
vi.mock("@/repo/users-arena", () => ({
  findActiveArenaRowByEmail: async () => null,
  findArchivedRowByEmail: async () => null,
  resolveOwnArenaSheetId: async () => "arena-sheet",
}));
vi.mock("@/service/daily-source", () => ({ isDbReadPilot: () => false, sourceCohort: () => "0" }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => false }));
vi.mock("./profile-stats-db", () => ({ profileStatsFromDb: async () => null }));
vi.mock("@/service/profile-stats-db", () => ({ profileStatsFromDb: async () => null }));
vi.mock("@/service/profile-bundle-cache", () => ({
  readBundle: async () => { throw new Error("no sheet in test"); },
  _resetSheetBundleFetchCount: () => {}, _getSheetBundleFetchCount: () => 0, _resetBundleCacheForTest: () => {}, warmBundle: () => {},
}));
import { loadMe } from "@/service/me";

const base = { email: "coach@example.test", name: "코스텝", cohort: "0", spreadsheetId: "own-sheet", status: "active", captainOf: "" };
beforeEach(() => { m.user = null; m.trainer = null; });

describe("트레이너 본인 수강생 페이지 토글", () => {
  it("활성 트레이너 + 같은 메일 수강생 행 → 그 시트로 토글", async () => {
    m.user = { ...base, role: "trainee" };
    m.trainer = { ...base, cohort: "T", spreadsheetId: "", role: "trainer", status: "active" };
    expect((await loadMe("coach@example.test")).ownArenaSheetId).toBe("own-sheet");
  });
  it("트레이너 자격이 없는 일반 수강생은 토글 없음", async () => {
    m.user = { ...base, role: "trainee" };
    expect((await loadMe("coach@example.test")).ownArenaSheetId).toBeUndefined();
  });
  it("승인 대기 수강생 행이면 토글 없음", async () => {
    m.user = { ...base, role: "trainee", status: "pending" };
    m.trainer = { ...base, role: "trainer", status: "active" };
    expect((await loadMe("coach@example.test")).ownArenaSheetId).toBeUndefined();
  });
  it("수강생 행 없는 트레이너는 예전처럼 아레나 시트", async () => {
    m.user = { ...base, cohort: "T", spreadsheetId: "", role: "trainer" };
    expect((await loadMe("coach@example.test")).ownArenaSheetId).toBe("arena-sheet");
  });
});
