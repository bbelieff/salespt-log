/**
 * 2026-11-06 belie 「트레이너관리에서 활성 수강생 전부 조회·수정 권한인데 담당만 열린다」 —
 * 담당이 아니어도 트레이너관리 권한(canAccessManagedStudent)이 허락하면 연다. 쓰기는 write 권한.
 * 관리자·트레이너 본인 수강생 페이지(0기 GM·0기 코스텝)는 담당이 아니면 열지 않는다. 가상 이메일만.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  students: {} as Record<string, { email: string; role: string; status: string; assignedTrainer: string; cohort: string }>,
  trainers: {} as Record<string, { role: string; status: string; cohort: string }>,
  grant: vi.fn(async (_actor: string, _target: string, _op: "read" | "write") => true),
  as: "" as string,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "salespt_as" && m.as ? { value: m.as } : undefined) }) }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "coach@example.com" } }) }));
vi.mock("@/auth/dev-stub", () => ({ isDevStubAuthed: async () => false }));
vi.mock("@/config", () => ({ adminEmails: () => ["boss@example.com"] }));
vi.mock("@/repo/users", () => ({
  findUserByEmail: async (e: string) => m.students[e.toLowerCase()] ?? null,
  findTrainerByEmail: async (e: string) => m.trainers[e.toLowerCase()] ?? null,
  parseAssignedTrainers: (v: string) => v.split(",").filter(Boolean),
}));
vi.mock("@/repo/users-arena", () => ({ resolveOwnArenaIdentity: async () => null }));
vi.mock("@/service/trainer-student-access", () => ({ canAccessManagedStudent: m.grant }));
import { canImpersonate } from "@/auth/identity";

const trainee = (email: string, assigned = "") => ({ email, role: "trainee", status: "active", assignedTrainer: assigned, cohort: "12" });
beforeEach(() => {
  m.students = { "mine@example.com": trainee("mine@example.com", "coach@example.com"), "other@example.com": trainee("other@example.com"), "boss@example.com": { ...trainee("boss@example.com"), cohort: "0" }, "peer@example.com": { ...trainee("peer@example.com"), cohort: "0" } };
  m.trainers = { "coach@example.com": { role: "trainer", status: "active", cohort: "T" }, "peer@example.com": { role: "trainer", status: "active", cohort: "T" } };
  m.grant.mockReset().mockResolvedValue(true);
  m.as = "";
});

describe("트레이너관리 권한으로 담당 아닌 수강생 열기", () => {
  it("담당이면 권한 조회 없이 연다", async () => {
    expect(await canImpersonate("coach@example.com", "mine@example.com")).toBe(true);
    expect(m.grant).not.toHaveBeenCalled();
  });
  it("담당이 아니어도 권한이 허락하면 연다 — 읽기·쓰기를 구분해 묻는다", async () => {
    expect(await canImpersonate("coach@example.com", "other@example.com")).toBe(true);
    expect(m.grant).toHaveBeenLastCalledWith("coach@example.com", "other@example.com", "read");
    m.grant.mockImplementation(async (_a, _t, op) => op === "read");
    expect(await canImpersonate("coach@example.com", "other@example.com", "write")).toBe(false);
  });
  it("권한이 없으면 열지 않는다", async () => {
    m.grant.mockResolvedValue(false);
    expect(await canImpersonate("coach@example.com", "other@example.com")).toBe(false);
  });
  it("관리자 본인 페이지(0기 GM)·다른 트레이너 본인 페이지(0기 코스텝)는 권한이 있어도 열지 않는다", async () => {
    expect(await canImpersonate("coach@example.com", "boss@example.com")).toBe(false);
    expect(await canImpersonate("coach@example.com", "peer@example.com")).toBe(false);
    expect(m.grant).not.toHaveBeenCalled();
  });
  it("비활성 트레이너는 권한 설정이 있어도 못 연다", async () => {
    m.trainers["coach@example.com"] = { role: "trainer", status: "pending", cohort: "T" };
    expect(await canImpersonate("coach@example.com", "other@example.com")).toBe(false);
  });
});
