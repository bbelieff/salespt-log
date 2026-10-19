// 2026-10-12 #7 — DB 경로 대시보드가 이미 읽은 계약·미팅으로 contractChannels 를 만든다(새 읽기 없음).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPayment } from "@/types";
import { loadDashboard } from "@/service/dashboard";

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  readSalesRowsFromDb: vi.fn(),
  readMeetingsFromDb: vi.fn(),
  readContractsFromDb: vi.fn(),
  readDbTabFromDb: vi.fn(),
  materializeOccurrences: vi.fn(),
  listExpenseEntries: vi.fn(),
  listRecurringOccurrences: vi.fn(),
  sheetRead: vi.fn(),
}));

vi.mock("@/repo/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/users")>()),
  findUserByEmail: mocks.findUserByEmail,
}));
vi.mock("@/repo/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/client")>()),
  dbEnabled: () => true,
  readSalesRowsFromDb: mocks.readSalesRowsFromDb,
}));
vi.mock("@/repo/db/read-daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/read-daily")>()),
  readMeetingsFromDb: mocks.readMeetingsFromDb,
  readContractsFromDb: mocks.readContractsFromDb,
}));
vi.mock("@/repo/db/read-db-tab", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/read-db-tab")>()),
  readDbTabFromDb: mocks.readDbTabFromDb,
}));
vi.mock("@/repo/db/expense-ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/expense-ledger")>()),
  materializeOccurrences: mocks.materializeOccurrences,
  listExpenseEntries: mocks.listExpenseEntries,
  listRecurringOccurrences: mocks.listRecurringOccurrences,
}));
// 시트 경로로 떨어지면 바로 실패하게(네트워크 금지) — 이 테스트는 DB 경로만 본다.
vi.mock("@/repo/dashboard", () => ({ readDashboard: mocks.sheetRead }));
vi.mock("@/repo/sales", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/sales")>()),
  readProfileBundle: mocks.sheetRead,
}));

const meeting = (id: string, 업체명: string, channel: string) => ({
  id, 예약일: "2026-07-12", 예약시각: "10:00", 미팅날짜: "2026-07-15", 미팅시간: "10:00", channel, 업체명,
  장소: "가상 카페", 예약비고: "", 상태: "계약", 계약여부: true, 수임비: 0, 미팅사유: "", 계약조건: "",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUserByEmail.mockResolvedValue({
    email: "student@example.invalid", name: "가상 수강생", cohort: "연습", spreadsheetId: "sheet-db", role: "trainee", courseStartISO: "2026-07-10", graduationISO: "2026-08-29",
  });
  mocks.readSalesRowsFromDb.mockResolvedValue([]);
  mocks.readMeetingsFromDb.mockResolvedValue([meeting("m-1", "가상상사A", "현수막"), meeting("m-2", "가상상사B", "매입DB")]);
  mocks.readContractsFromDb.mockResolvedValue([
    ContractPayment.parse({ row: 3, 계약일: "2026-07-15", 업체명: "가상상사A(이름변경)", 수임비: 1_000, linkedMeetingId: "m-1" }),
    ContractPayment.parse({ row: 4, 계약일: "2026-07-15", 업체명: "가상상사B", 수임비: 2_000 }),
    ContractPayment.parse({ row: 5, 계약일: "2026-07-16", 업체명: "가상상사C", 수임비: 3_000, linkedMeetingId: "manual:req-1" }),
  ]);
  mocks.readDbTabFromDb.mockResolvedValue({ purchases: [], productions: [], banners: [] });
  mocks.materializeOccurrences.mockResolvedValue(undefined);
  mocks.listExpenseEntries.mockResolvedValue([]);
  mocks.listRecurringOccurrences.mockResolvedValue([]);
  mocks.sheetRead.mockRejectedValue(new Error("sheet path must not run"));
});
afterEach(() => vi.useRealTimers());

describe("dashboard DB path — contractChannels", () => {
  it("leaves in-course chart and KPI semantics unchanged", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-15T03:00:00Z"));
    const view = await loadDashboard("student@example.invalid");
    expect(view.weeklyTrendPeriod).toBeUndefined();
    expect(view.weeklyTrend).toHaveLength(8);
    expect(view.weeklyTrend[0]).toEqual({ 주차: 1, 계약수: 2, 활동량: 4 });
  });
  it("serves recent records after graduation without changing course totals or reading again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T03:00:00Z"));
    mocks.readSalesRowsFromDb.mockResolvedValue([{ date: "2026-10-19", channel: "매입DB", production: 4, contactProgress: 2, inflow: 3, meetingReservation: 0 }]);
    mocks.readMeetingsFromDb.mockResolvedValue([meeting("new", "합성 최근 업체", "매입DB")].map(m => ({ ...m, 미팅날짜: "2026-10-19", 예약일: "2026-10-19" })));
    const view = await loadDashboard("student@example.invalid");
    expect(view.weeklyTrendPeriod).toEqual({ kind: "recent", startISO: "2026-08-28", endISO: "2026-10-19", status: "available" });
    expect(view.weeklyTrend[7]).toMatchObject({ 계약수: 1, 활동량: 9 });
    expect(view.channelMatrix[0]).toMatchObject({ 생산: 0, 유입: 0, 컨택진행: 0, 계약: 0 });
    expect(mocks.readSalesRowsFromDb).toHaveBeenCalledTimes(1);
    expect(mocks.readMeetingsFromDb).toHaveBeenCalledTimes(1);
    expect(mocks.sheetRead).not.toHaveBeenCalled();
  });
  it("AK → 미팅, 계약일|업체명 대체, manual → null", async () => {
    const view = await loadDashboard("student@example.invalid");
    expect(mocks.sheetRead).not.toHaveBeenCalled();
    expect(view.contractChannels).toEqual([
      { key: "3|ak:m-1", channel: "현수막" },
      { key: "4|2026-07-15|가상상사B", channel: "매입DB" },
      { key: "5|ak:manual:req-1", channel: null },
    ]);
    expect(mocks.readMeetingsFromDb).toHaveBeenCalledTimes(1);
    expect(mocks.readContractsFromDb).toHaveBeenCalledTimes(1);
  });
});
