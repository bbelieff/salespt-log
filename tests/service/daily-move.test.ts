import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelDailyRowMetrics } from "@/service";
const { loadDay, saveContactMetrics } = vi.hoisted(() => ({ loadDay: vi.fn(), saveContactMetrics: vi.fn() }));
vi.mock("@/lib/service/contact", () => ({ loadDay, saveContactMetrics }));
import { moveDailyMetrics } from "@/lib/service/daily-move";
const metric = (inflow: number, contactProgress: number, meetingReservation: number): ChannelDailyRowMetrics => ({ production: 0, inflow, contactProgress, meetingReservation });
beforeEach(() => { vi.resetAllMocks(); });
describe("날짜 이동 저장 후 수치", () => {
  it("미팅 이동 후 H 재계산 값을 반환하고 기존 대상 수치에 더한다", async () => {
    loadDay.mockImplementation(async (_email: string, date: string) => ({ channels: { 매입DB: date === "2026-09-10" ? metric(1, 1, 1) : metric(5, 2, 2) } }));
    const result = await moveDailyMetrics("fixture@example.invalid", {
      from: { date: "2026-09-10", channel: "매입DB", metrics: metric(4, 2, 2) },
      to: { date: "2026-09-09", channel: "매입DB", metrics: metric(2, 1, 1) },
      deltas: { inflow: 3, contactProgress: 1 },
    });
    expect(saveContactMetrics).toHaveBeenNthCalledWith(1, "fixture@example.invalid", "2026-09-09", { 매입DB: metric(5, 2, 1) });
    expect(saveContactMetrics).toHaveBeenNthCalledWith(2, "fixture@example.invalid", "2026-09-10", { 매입DB: metric(1, 1, 2) });
    // 호출부가 로지텍을 원래 날짜에 함께 저장한 후 H=1을 재조회한다.
    expect(result.from.meetingReservation).toBe(1);
    expect(result.to.meetingReservation).toBe(2);
  });
  it("같은 날짜 다른 채널은 한 번에 쓰고 한 번 읽는다", async () => {
    loadDay.mockResolvedValue({ channels: { 매입DB: metric(0, 0, 0), 현수막: metric(4, 2, 2) } });
    await moveDailyMetrics("fixture@example.invalid", {
      from: { date: "2026-09-10", channel: "매입DB", metrics: metric(4, 2, 2) },
      to: { date: "2026-09-10", channel: "현수막", metrics: metric(0, 0, 0) },
      deltas: { inflow: 4, contactProgress: 2 },
    });
    expect(saveContactMetrics).toHaveBeenCalledTimes(1);
    expect(loadDay).toHaveBeenCalledTimes(1);
  });
});
