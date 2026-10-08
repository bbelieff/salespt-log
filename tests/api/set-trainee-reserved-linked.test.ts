import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth/identity", () => ({
  getSessionEmail: async () => "admin@example.com",
  isAdminEmail: () => true,
}));
vi.mock("@/auth/revalidate-admin", () => ({ revalidateAdminPages: () => {} }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_n: string, h: unknown) => h }));

const row = (email: string, cohort: string, spreadsheetId: string) => ({
  email, cohort, name: "가나다", spreadsheetId, role: "trainee", status: "active",
});
const users = [
  row("a@example.com", "10", "sheet-1"),
  row("b@example.com", "10", "sheet-1"),
  row("c@example.com", "유보", "sheet-1"),
  row("d@example.com", "10", "sheet-2"),
];
const setTraineeReservation = vi.fn(async (_e: string, _r: boolean) => {});
vi.mock("@/repo/users", () => ({
  findUserByEmail: async (e: string) => users.find((u) => u.email === e) ?? null,
  listAllUsers: async () => users,
  isReservedTrainee: (u: { cohort: string }) => u.cohort === "유보",
  setTraineeReservation: (e: string, r: boolean) => setTraineeReservation(e, r),
}));

import { POST } from "@/app/api/admin/set-trainee-reserved/route";

const req = (email: string, reserved: boolean) =>
  new Request("http://x", { method: "POST", body: JSON.stringify({ email, reserved }) });

describe("연결 계정 함께 유보", () => {
  beforeEach(() => setTraineeReservation.mockClear());

  it("같은 시트를 쓰는 다른 이메일도 함께 유보하고, 다른 시트는 건드리지 않는다", async () => {
    const res = await POST(req("a@example.com", true));
    expect(res.status).toBe(200);
    const done = setTraineeReservation.mock.calls.map((c) => c[0]).sort();
    expect(done).toEqual(["a@example.com", "b@example.com"]);
  });

  it("복귀도 같은 시트의 유보 계정을 함께 되돌린다", async () => {
    await POST(req("a@example.com", false));
    const done = setTraineeReservation.mock.calls.map((c) => c[0]).sort();
    expect(done).toEqual(["a@example.com", "c@example.com"]);
  });
});
