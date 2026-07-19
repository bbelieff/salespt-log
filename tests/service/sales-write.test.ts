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
