/**
 * R4 W1-1 회귀 — **무제한 쓰기의 왕복 보장**(적대리뷰 B1 blocker 재발 방지).
 *
 * 초판은 쓰기만 열고 `loadDay` 의 주차 상한 지우기(`inRange ? metricRows : []`)를 그대로 둬서:
 *   11주+ 저장 200 OK → 화면 전부 0 → 그 0 이 draft 로 시드 → 다음 저장이 **정본을 0 으로 덮음**.
 * = 기능이 write-only 인 동시에 **데이터 손실 루프**. 여기서 "DB 정본 경로는 상한으로 지우지
 * 않는다"를 고정한다. 시트 폴백 경로는 기존대로 창 밖 = 빈 값(시트엔 좌표 자체가 없다).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmail = vi.fn();
const dbEnabled = vi.fn(() => true);
const readSalesRowsFromDb = vi.fn();
const readMeetingsFromDb = vi.fn(async () => []);
const readBannerOrderQtyFromDb = vi.fn(async () => 0);
const readCourseStart = vi.fn();
const readWeek = vi.fn(async () => ({ rows: [] }));
const readChannelStacking = vi.fn(async () => [[0, 0, 0, 0], [0, 0, 0, 0]]);
const findByDate = vi.fn(async () => []);
const readWeekFunnel = vi.fn(async () => ({ 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 }));
const readBanners = vi.fn(async () => ({ rows: [] }));

vi.mock("@/repo/users", () => ({ findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])) }));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  readSalesRowsFromDb: (...a: unknown[]) => readSalesRowsFromDb(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (...a: unknown[]) => readMeetingsFromDb(...(a as [])),
  readBannerOrderQtyFromDb: (...a: unknown[]) => readBannerOrderQtyFromDb(...(a as [])),
}));
vi.mock("@/repo/sales", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    readCourseStart: (...a: unknown[]) => readCourseStart(...(a as [])),
    readWeek: (...a: unknown[]) => readWeek(...(a as [])),
    readWeekFunnel: (...a: unknown[]) => readWeekFunnel(...(a as [])),
  };
});
vi.mock("@/repo/dashboard", () => ({
  readChannelStacking: (...a: unknown[]) => readChannelStacking(...(a as [])),
}));
vi.mock("@/repo/meetings", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, findByDate: (...a: unknown[]) => findByDate(...(a as [])) };
});
vi.mock("@/repo/db", () => ({ readBanners: (...a: unknown[]) => readBanners(...(a as [])) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { loadDay } from "@/service/contact";

const EMAIL = "grad@x.y";
const SHEET = "sheet-pilot";
const COURSE_START = "2026-06-01";
/** 수강시작 + 11주(=12주차 구간) — 시트 주차블록(MAX_SHEET_WEEK=10) 밖. */
const WEEK12 = "2026-08-21";

beforeEach(() => {
  for (const m of [
    findUserByEmail, dbEnabled, readSalesRowsFromDb, readMeetingsFromDb,
    readBannerOrderQtyFromDb, readCourseStart, readWeek, readChannelStacking,
    findByDate, readWeekFunnel, readBanners,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  findUserByEmail.mockResolvedValue({
    email: EMAIL, spreadsheetId: SHEET, cohort: "8", // 파일럿
    status: "archived", courseStartISO: COURSE_START, role: "trainee",
  });
  readCourseStart.mockResolvedValue(new Date(2026, 5, 1));
  readMeetingsFromDb.mockResolvedValue([]);
  readBannerOrderQtyFromDb.mockResolvedValue(0);
  readWeek.mockResolvedValue({ rows: [] });
  readChannelStacking.mockResolvedValue([[0, 0, 0, 0], [0, 0, 0, 0]]);
  findByDate.mockResolvedValue([]);
  readBanners.mockResolvedValue({ rows: [] });
});

describe("R4 무제한 왕복 — 11주+ 저장분이 화면에서 사라지지 않는다", () => {
  it("🐛B1: 12주차 DB 정본 행이 loadDay 에 그대로 실린다(0 으로 지워지면 회귀)", async () => {
    readSalesRowsFromDb.mockResolvedValue([
      { date: WEEK12, channel: "매입DB", production: 7, inflow: 5, contactProgress: 3, meetingReservation: 0 },
    ]);
    const view = await loadDay(EMAIL, WEEK12);
    expect(view.channels["매입DB"]).toMatchObject({ production: 7, inflow: 5, contactProgress: 3 });
  });

  it("코스 기간(1~10주) 동작은 불변", async () => {
    const inWindow = "2026-06-03"; // 1주차
    readSalesRowsFromDb.mockResolvedValue([
      { date: inWindow, channel: "매입DB", production: 2, inflow: 1, contactProgress: 1, meetingReservation: 0 },
    ]);
    const view = await loadDay(EMAIL, inWindow);
    expect(view.channels["매입DB"]).toMatchObject({ production: 2, inflow: 1, contactProgress: 1 });
  });

  it("DB read 실패 → 시트 폴백에서는 창 밖이 빈 값(시트엔 좌표가 없다) — 폴백 계약 보존", async () => {
    readSalesRowsFromDb.mockRejectedValue(new Error("db down"));
    const view = await loadDay(EMAIL, WEEK12);
    expect(view.channels["매입DB"]).toMatchObject({ production: 0, inflow: 0, contactProgress: 0 });
    expect(readWeek).not.toHaveBeenCalled(); // 창 밖이라 주차 read 자체를 안 함
  });
});
