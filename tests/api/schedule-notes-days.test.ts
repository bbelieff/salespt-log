/** /api/schedule-notes GET — days(1~42, 기본 7)로 메모 읽는 날짜 수를 정한다(한 달 보드). 가상 이메일만. */
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ view: vi.fn(), get: vi.fn() }));
vi.mock("@/auth/identity", () => ({
  requireStudentViewContext: mocks.view,
  getWritableUserEmail: vi.fn(),
  StudentViewContextError: class extends Error { constructor(public code: string, public status: number) { super(code); } },
}));
vi.mock("@/service", () => ({ getScheduleNotes: mocks.get, saveScheduleNote: vi.fn() }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_key: string, fn: unknown) => fn }));
import { GET } from "../../app/api/schedule-notes/route";

const req = (q: string) => new NextRequest(`https://example.test/api/schedule-notes?from=2026-10-30&issuesWeek=2026-10-30${q}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.view.mockResolvedValue({ email: "synthetic@example.test" });
  mocks.get.mockResolvedValue({ memos: {}, issues: [] });
});

it("days 가 없으면 7일", async () => {
  expect((await GET(req(""))).status).toBe(200);
  const dates = mocks.get.mock.calls[0]![1] as string[];
  expect(dates).toHaveLength(7);
  expect(dates[0]).toBe("2026-10-30");
  expect(dates[6]).toBe("2026-11-05");
});

it("days=42 면 달력 6줄(42일)을 읽는다", async () => {
  expect((await GET(req("&days=42"))).status).toBe(200);
  const dates = mocks.get.mock.calls[0]![1] as string[];
  expect(dates).toHaveLength(42);
  expect(dates[41]).toBe("2026-12-10");
});

it.each(["0", "43", "abc", "7.5"])("days=%s 는 거절하고 읽지 않는다", async (d) => {
  expect((await GET(req(`&days=${d}`))).status).toBe(400);
  expect(mocks.get).not.toHaveBeenCalled();
});
