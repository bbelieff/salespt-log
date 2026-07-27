/**
 * R3-1 sales 쓰기 정본 + mirror_pending 안전망(§2.2·§7-3) 회귀 (#579 per-row 수렴 구조 기준).
 * 고정하는 계약:
 *   ① 파일럿(DB) = writeSalesRowsToDb 정본 + 행별 수렴 미러(queueSalesRowSync→runSalesRowSync).
 *      미러 성공(편집기간 밖 no-op 포함)→clearMirrorPending·최종 실패→markMirrorPending(+Sentry).
 *   ② 응답은 미러와 무관하게 즉시 성공(정본=DB).
 *   ③ 밀린 다른 pending 행을 drain 으로 재드라이브(이번 저장분 제외), 성공 시 해제.
 *   ④ 비파일럿/미설정 = 시트 정본(batchWrite) — mark/clear/drain 미개입.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelDailyRow } from "@/types";

/** readSalesRowFromDb 반환 형태(= client.ts DbSalesRow, 타입 export 아님 → 테스트 로컬 정의). */
interface DbSalesRow {
  date: string;
  channel: string;
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation: number;
}

const dbEnabled = vi.fn(() => true);
const writeSalesRowsToDb = vi.fn();
const readSalesRowFromDb = vi.fn();
const upsertSheetRow = vi.fn();
const readMeetingsFromDb = vi.fn();
const batchWriteChannelDailyRows = vi.fn();
const decrementMeetingReservation = vi.fn();
const writeProductionCell = vi.fn();
const writeSalesRowCells = vi.fn();
const isWithinSalesWindow = vi.fn();
const markMirrorPending = vi.fn();
const clearMirrorPending = vi.fn();
const listMirrorPending = vi.fn();
const captureServerEvent = vi.fn();
const captureException = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  writeSalesRowsToDb: (...a: unknown[]) => writeSalesRowsToDb(...(a as [])),
  readSalesRowFromDb: (...a: unknown[]) => readSalesRowFromDb(...(a as [])),
  upsertSheetRow: (...a: unknown[]) => upsertSheetRow(...(a as [])),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (...a: unknown[]) => readMeetingsFromDb(...(a as [])),
}));
vi.mock("@/repo/sales", () => ({
  batchWriteChannelDailyRows: (...a: unknown[]) => batchWriteChannelDailyRows(...(a as [])),
  decrementMeetingReservation: (...a: unknown[]) => decrementMeetingReservation(...(a as [])),
}));
vi.mock("@/repo/sales-production-cell", () => ({
  writeProductionCell: (...a: unknown[]) => writeProductionCell(...(a as [])),
}));
vi.mock("@/repo/sales-row-write", () => ({
  writeSalesRowCells: (...a: unknown[]) => writeSalesRowCells(...(a as [])),
  isWithinSalesWindow: (...a: unknown[]) => isWithinSalesWindow(...(a as [])),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: (...a: unknown[]) => markMirrorPending(...(a as [])),
  clearMirrorPending: (...a: unknown[]) => clearMirrorPending(...(a as [])),
  listMirrorPending: (...a: unknown[]) => listMirrorPending(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...(a as [])),
}));

import { persistSalesRows } from "@/service/sales-write";

const SHEET = "sheet-pilot";
const EMAIL = "u@x.y";

const mkRow = (o: Partial<ChannelDailyRow> = {}): ChannelDailyRow => ({
  date: "2026-07-15",
  channel: "현수막",
  production: 3,
  inflow: 2,
  contactProgress: 1,
  meetingReservation: 0,
  ...o,
});
const mkDbRow = (o: Partial<DbSalesRow> = {}): DbSalesRow => ({
  date: "2026-07-15",
  channel: "현수막",
  production: 3,
  inflow: 2,
  contactProgress: 1,
  meetingReservation: 0,
  ...o,
});

beforeEach(() => {
  for (const m of [
    dbEnabled, writeSalesRowsToDb, readSalesRowFromDb, upsertSheetRow, readMeetingsFromDb,
    batchWriteChannelDailyRows, decrementMeetingReservation, writeProductionCell,
    writeSalesRowCells, isWithinSalesWindow, markMirrorPending, clearMirrorPending,
    listMirrorPending, captureServerEvent, captureException,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  writeSalesRowsToDb.mockResolvedValue(undefined);
  readSalesRowFromDb.mockResolvedValue(mkDbRow());
  writeSalesRowCells.mockResolvedValue(true);
  // 기본 = 시트 좌표 있는 주차(1~MAX_SHEET_WEEK). R4 W1-1 부터 persistSalesRows 도 이 게이트를
  // 타며, 11주+(false)만 미러를 건너뛴다 — 아래 "R4 무제한" describe 가 그 분기를 고정.
  isWithinSalesWindow.mockResolvedValue(true);
  batchWriteChannelDailyRows.mockResolvedValue(undefined);
  markMirrorPending.mockResolvedValue(undefined);
  clearMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10)); // fire-and-forget 배수
});

describe("파일럿 DB 정본 + 행별 수렴 미러 표식", () => {
  it("미러 성공 → writeSalesRowsToDb 정본 + clearMirrorPending(sales, {date}:{channel})", async () => {
    await persistSalesRows("8", EMAIL, SHEET, [mkRow()]);
    expect(writeSalesRowsToDb).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(clearMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "sales",
      rowKey: "2026-07-15:현수막",
    });
    expect(markMirrorPending).not.toHaveBeenCalled();
  });

  it("시트 미러 최종 실패 → 응답 성공 + markMirrorPending + sheet_mirror_error", async () => {
    writeSalesRowCells.mockRejectedValue(new Error("sheet 500"));
    await expect(persistSalesRows("8", EMAIL, SHEET, [mkRow()])).resolves.toBeUndefined();
    await vi.waitFor(
      () => expect(markMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "sales",
        rowKey: "2026-07-15:현수막",
      }),
      { timeout: 3000 },
    );
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "sales" });
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });
});

describe("drain — 밀린 행 self-heal (행별)", () => {
  it("이번 저장분 외 pending 행을 최신 DB 로 재드라이브(성공 시 해제)", async () => {
    listMirrorPending.mockResolvedValue(["2026-07-01:직접생산", "2026-07-15:현수막"]);
    // runSalesRowSync 는 date/channel 로 readSalesRowFromDb 를 다시 읽는다.
    readSalesRowFromDb.mockImplementation(async (_id: string, date: string, channel: string) =>
      mkDbRow({ date, channel }),
    );
    await persistSalesRows("8", EMAIL, SHEET, [mkRow()]);
    await vi.waitFor(() =>
      expect(clearMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "sales",
        rowKey: "2026-07-01:직접생산",
      }),
    );
    // 드레인이 밀린 행을 date/channel 분해해 시트에 되씀.
    expect(writeSalesRowCells).toHaveBeenCalledWith(
      SHEET,
      "2026-07-01",
      "직접생산",
      expect.objectContaining({ date: "2026-07-01", channel: "직접생산" }),
    );
  });
});

describe("비파일럿/미설정 = 시트 정본, 표식 미개입", () => {
  it("7기 = batchWrite 시트 정본, DB·mark/clear 안 씀", async () => {
    await persistSalesRows("7", EMAIL, SHEET, [mkRow()]);
    expect(batchWriteChannelDailyRows).toHaveBeenCalledWith(SHEET, [mkRow()]);
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
    expect(markMirrorPending).not.toHaveBeenCalled();
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });

  it("DATABASE_URL 미설정 = 파일럿도 시트(즉시 R2)", async () => {
    dbEnabled.mockReturnValue(false);
    await persistSalesRows("8", EMAIL, SHEET, [mkRow()]);
    expect(batchWriteChannelDailyRows).toHaveBeenCalledWith(SHEET, [mkRow()]);
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
  });
});

/**
 * R4 W1-1 — 쓰기 무제한(ADR-0029 G1). 시트 주차블록은 MAX_SHEET_WEEK 까지만 존재하므로
 * 그 밖(11주+)은 **DB-only**: 정본은 기록하되 시트 write·미러를 건너뛰고, 영원히 수렴 못 할 행을
 * mirror_pending 에 쌓지 않는다(self-heal 큐 오염 금지).
 */
describe("R4 무제한 — 시트 창 밖(11주+) 은 DB-only", () => {
  it("창 밖: DB 정본은 기록 · 시트 미러/표식은 없음", async () => {
    isWithinSalesWindow.mockResolvedValue(false); // 11주+ = 시트 좌표 없음
    await persistSalesRows("8", EMAIL, SHEET, [mkRow({ date: "2026-09-30" })]);
    expect(writeSalesRowsToDb).toHaveBeenCalledTimes(1); // 저장은 정상(무제한 쓰기)
    await new Promise((r) => setTimeout(r, 20)); // 미러 큐가 돌 틈을 준다
    expect(writeSalesRowCells).not.toHaveBeenCalled(); // 시트 write 없음
    expect(markMirrorPending).not.toHaveBeenCalled(); // pending 오염 없음
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });

  it("창 안/밖 혼재 저장: 창 안 행만 미러 큐에 오른다", async () => {
    isWithinSalesWindow.mockImplementation(async (_sid: unknown, date: unknown) =>
      date === "2026-07-15",
    );
    await persistSalesRows("8", EMAIL, SHEET, [
      mkRow({ date: "2026-07-15" }), // 창 안
      mkRow({ date: "2026-09-30" }), // 창 밖(11주+)
    ]);
    expect(writeSalesRowsToDb).toHaveBeenCalledTimes(1); // 두 행 모두 DB 정본
    await vi.waitFor(() => expect(writeSalesRowCells).toHaveBeenCalledTimes(1));
    expect(writeSalesRowCells).toHaveBeenCalledWith(
      SHEET, "2026-07-15", "현수막", expect.anything(),
    );
  });

  it("비파일럿은 완전 불변 — 창 판정 자체를 하지 않고 기존 시트 경로", async () => {
    isWithinSalesWindow.mockResolvedValue(false);
    await persistSalesRows("7", EMAIL, SHEET, [mkRow({ date: "2026-09-30" })]);
    expect(batchWriteChannelDailyRows).toHaveBeenCalledTimes(1); // R2 그대로
    expect(isWithinSalesWindow).not.toHaveBeenCalled();
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
  });
});
