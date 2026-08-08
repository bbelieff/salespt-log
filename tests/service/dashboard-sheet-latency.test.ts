import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPayment } from "@/types";
import { loadDashboard } from "@/service/dashboard";

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  resolveOwnArenaSheetId: vi.fn(),
  readDashboard: vi.fn(),
  readPurchases: vi.fn(),
  readProductions: vi.fn(),
  readBanners: vi.fn(),
  readContractPayments: vi.fn(),
  readProfileBundle: vi.fn(),
  dbEnabled: vi.fn(),
  findByDateRange: vi.fn(),
  materializeOccurrences: vi.fn(),
  listExpenseEntries: vi.fn(),
  listRecurringOccurrences: vi.fn(),
}));

vi.mock("@/repo/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/users")>()),
  findUserByEmail: mocks.findUserByEmail,
}));
vi.mock("@/repo/users-arena", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/users-arena")>()),
  resolveOwnArenaSheetId: mocks.resolveOwnArenaSheetId,
}));
vi.mock("@/repo/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/dashboard")>()),
  readDashboard: mocks.readDashboard,
}));
vi.mock("@/repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db")>()),
  readPurchases: mocks.readPurchases,
  readProductions: mocks.readProductions,
  readBanners: mocks.readBanners,
}));
vi.mock("@/repo/contract-payment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/contract-payment")>()),
  readAll: mocks.readContractPayments,
}));
vi.mock("@/repo/sales", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/sales")>()),
  readProfileBundle: mocks.readProfileBundle,
}));
vi.mock("@/repo/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/client")>()),
  dbEnabled: mocks.dbEnabled,
}));
vi.mock("@/repo/meetings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/meetings")>()),
  findByDateRange: mocks.findByDateRange,
}));
vi.mock("@/repo/db/expense-ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/expense-ledger")>()),
  materializeOccurrences: mocks.materializeOccurrences,
  listExpenseEntries: mocks.listExpenseEntries,
  listRecurringOccurrences: mocks.listRecurringOccurrences,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const sheetData = {
  finance: [700, 0, 0, 0, 0, 0],
  funnelTotals: [],
  productivity: [],
  channelKL: [],
  channelStacking: [
    [10, 20, 30, 40],
    [9, 19, 29, 39],
    [8, 18, 28, 38],
    [7, 17, 27, 37],
    [6, 16, 26, 36],
    [2, 1, 0, 0],
  ],
  weeklyContracts: [2, 1, 0, 0, 0, 0, 0, 0],
  weeklyActivity: [100, 200, 0, 0, 0, 0, 0, 0],
};

const profile = {
  cohort: "테스트기수",
  name: "테스터",
  courseStart: new Date(2026, 0, 1),
  graduation: new Date(2026, 1, 20),
  stats: { 미팅예정: 0, 미팅완료: 0, 계약: 0 },
};

const terminatedPayment = ContractPayment.parse({
  계약일: "2026-01-02",
  업체명: "종료 업체",
  linkedMeetingId: "meeting-1",
  해지일: "2026-01-20",
});

const linkedMeeting = {
  id: "meeting-1",
  미팅날짜: "2026-01-02",
  업체명: "종료 업체",
  channel: "매입DB",
  계약여부: true,
};

function seoulTodayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUserByEmail.mockResolvedValue({
    email: "student@example.com",
    name: "테스터",
    cohort: "테스트기수",
    spreadsheetId: "sheet-1",
    role: "trainee",
  });
  mocks.resolveOwnArenaSheetId.mockResolvedValue(null);
  mocks.readDashboard.mockResolvedValue(sheetData);
  mocks.readPurchases.mockResolvedValue({ rows: [{ 주문금액: 1_000 }] });
  mocks.readProductions.mockResolvedValue({ rows: [{ 기간예산: 2_000 }] });
  mocks.readBanners.mockResolvedValue({ rows: [{ 주문금액: 3_000 }] });
  mocks.readContractPayments.mockResolvedValue([terminatedPayment]);
  mocks.readProfileBundle.mockResolvedValue(profile);
  mocks.dbEnabled.mockReturnValue(false);
  mocks.findByDateRange.mockResolvedValue(new Map([
    ["2026-01-02", [linkedMeeting]],
  ]));
  mocks.materializeOccurrences.mockResolvedValue(undefined);
  mocks.listExpenseEntries.mockResolvedValue([]);
  mocks.listRecurringOccurrences.mockResolvedValue([]);
});

describe("dashboard sheet fallback latency", () => {
  it("starts the profile-dependent meetings read while another initial read is still pending", async () => {
    const profileGate = deferred<typeof profile>();
    const dashboardGate = deferred<typeof sheetData>();
    mocks.readProfileBundle.mockReturnValueOnce(profileGate.promise);
    mocks.readDashboard.mockReturnValueOnce(dashboardGate.promise);

    let completed = false;
    const resultPromise = loadDashboard("student@example.com").then((result) => {
      completed = true;
      return result;
    });

    await vi.waitFor(() => {
      expect(mocks.readProfileBundle).toHaveBeenCalledTimes(1);
      expect(mocks.readDashboard).toHaveBeenCalledTimes(1);
    });
    expect(mocks.findByDateRange).not.toHaveBeenCalled();
    profileGate.resolve(profile);
    await profileGate.promise;

    expect(completed).toBe(false);
    expect(mocks.findByDateRange).toHaveBeenCalledTimes(1);
    const [sheetId, dates, kind] = mocks.findByDateRange.mock.calls[0]!;
    expect(sheetId).toBe("sheet-1");
    expect(kind).toBe("meeting");
    expect(dates).toHaveLength(84);
    expect(dates[0]).toBe("2026-01-01");

    dashboardGate.resolve(sheetData);
    const result = await resultPromise;

    expect(result).toEqual({
      kpi: {
        영업이익: -6_000,
        영업이익률: 0,
        총매출: 0,
        총비용: 6_000,
        누적수임비: 700,
        수임비합: 0,
        수수료합: 0,
        이월매출: 0,
        전체매출: 0,
        이월비용: 0,
        전체비용: 6_000,
      },
      channelMatrix: [
        { 채널: "매입DB", 생산: 10, 유입: 9, 컨택진행: 8, 미팅예약: 7, 미팅완료: 6, 계약: 1 },
        { 채널: "직접생산", 생산: 20, 유입: 19, 컨택진행: 18, 미팅예약: 17, 미팅완료: 16, 계약: 1 },
        { 채널: "현수막", 생산: 30, 유입: 29, 컨택진행: 28, 미팅예약: 27, 미팅완료: 26, 계약: 0 },
        { 채널: "콜·지·기·소", 생산: 40, 유입: 39, 컨택진행: 38, 미팅예약: 37, 미팅완료: 36, 계약: 0 },
      ],
      additionalCost: {
        status: "available",
        dbCostTotal: 6_000,
        additionalCost: 0,
        recognizedThrough: seoulTodayISO(),
      },
      weeklyTrend: [
        { 주차: 1, 계약수: 1, 활동량: 100 },
        { 주차: 2, 계약수: 1, 활동량: 200 },
        { 주차: 3, 계약수: 0, 활동량: 0 },
        { 주차: 4, 계약수: 0, 활동량: 0 },
        { 주차: 5, 계약수: 0, 활동량: 0 },
        { 주차: 6, 계약수: 0, 활동량: 0 },
        { 주차: 7, 계약수: 0, 활동량: 0 },
        { 주차: 8, 계약수: 0, 활동량: 0 },
      ],
      costBreakdown: [
        { 채널: "매입DB", 비용: 1_000 },
        { 채널: "직접생산", 비용: 2_000 },
        { 채널: "현수막", 비용: 3_000 },
      ],
      콜지기소수임비: 0,
    });

    const sheetsReads = [
      mocks.readDashboard,
      mocks.readPurchases,
      mocks.readProductions,
      mocks.readBanners,
      mocks.readContractPayments,
      mocks.readProfileBundle,
      mocks.findByDateRange,
    ];
    expect(sheetsReads.reduce((sum, read) => sum + read.mock.calls.length, 0)).toBe(7);
  });

  it("propagates a profile rejection without invoking the meetings read", async () => {
    const profileGate = deferred<typeof profile>();
    const profileError = new Error("profile read failed");
    mocks.readProfileBundle.mockReturnValueOnce(profileGate.promise);

    const resultPromise = loadDashboard("student@example.com");
    profileGate.reject(profileError);

    await expect(resultPromise).rejects.toBe(profileError);
    expect(mocks.findByDateRange).not.toHaveBeenCalled();
  });
});
