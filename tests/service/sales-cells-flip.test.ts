/**
 * R3⑤ PR-2 — 단일셀 writer 2개(생산 E · 미팅예약 H) DB 정본 전환. 계약 고정:
 *  ① 파일럿: DB 동기 upsert(정본) + 시트 **수렴** 미러. 시트 직접 write 안 함.
 *  ② 비파일럿·DB꺼짐: **완전 불변**(writeProductionCell / decrementMeetingReservation 그대로).
 *  ③ **편집기간(1~10주) 밖**: 시트 좌표가 없으므로 **DB 에도 안 쓴다**(무필터 집계 부풀림 방지).
 *  ④ H 는 ±1 RMW 폐기 → **카드수 절대 재계산**(ADR-0010). 재집계는 **readMeetingsFromDb** —
 *     findMeetingsByDateRecord 는 DB 0건 시 시트 폴백이라 **지운 카드가 부활**한다.
 *  ⑤ 수렴 미러: **실행 시점 최신 DB 행**을 시트 E:H 로 (스냅샷 재생 아님).
 *  ⑥ 콜·지·기·소는 생산·유입 동시(ADR-0029).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const upsertSheetRow = vi.fn(async (_p: unknown) => ({ skipped: false }));
const readSalesRowFromDb = vi.fn(async (_s: string, _d: string, _c: string) => null as unknown);
const writeSalesRowsToDb = vi.fn(async (_p: unknown) => {});
const readMeetingsFromDb = vi.fn(async (_s: string) => [] as Array<Record<string, unknown>>);
const writeProductionCell = vi.fn(async (..._a: unknown[]) => {});
const decrementMeetingReservation = vi.fn(async (..._a: unknown[]) => ({ before: 1, after: 0 }));
const batchWriteChannelDailyRows = vi.fn(async (..._a: unknown[]) => {});
const isWithinSalesWindow = vi.fn(async (..._a: unknown[]) => true);
const writeSalesRowCells = vi.fn(async (..._a: unknown[]) => true);

vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => dbEnabled(),
  upsertSheetRow: (p: unknown) => upsertSheetRow(p),
  readSalesRowFromDb: (s: string, d: string, c: string) => readSalesRowFromDb(s, d, c),
  writeSalesRowsToDb: (p: unknown) => writeSalesRowsToDb(p),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (s: string) => readMeetingsFromDb(s),
}));
vi.mock("@/repo/sales", () => ({
  batchWriteChannelDailyRows: (...a: unknown[]) => batchWriteChannelDailyRows(...a),
  decrementMeetingReservation: (...a: unknown[]) => decrementMeetingReservation(...a),
}));
vi.mock("@/repo/sales-production-cell", () => ({
  writeProductionCell: (...a: unknown[]) => writeProductionCell(...a),
}));
vi.mock("@/repo/sales-row-write", () => ({
  isWithinSalesWindow: (...a: unknown[]) => isWithinSalesWindow(...a),
  writeSalesRowCells: (...a: unknown[]) => writeSalesRowCells(...a),
}));

import {
  persistMeetingReservationCount,
  persistProductionCell,
  type SalesCtx,
} from "@/service/sales-write";

const SHEET = "sheet-1";
const DATE = "2026-04-18";
const pilot: SalesCtx = { spreadsheetId: SHEET, cohort: "8", email: "u@x.y" };
const nonPilot: SalesCtx = { spreadsheetId: SHEET, cohort: "1", email: "u@x.y" };

beforeEach(() => {
  for (const m of [
    upsertSheetRow, readSalesRowFromDb, writeSalesRowsToDb, readMeetingsFromDb,
    writeProductionCell, decrementMeetingReservation, batchWriteChannelDailyRows,
    isWithinSalesWindow, writeSalesRowCells, dbEnabled,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  upsertSheetRow.mockResolvedValue({ skipped: false });
  isWithinSalesWindow.mockResolvedValue(true);
  writeSalesRowCells.mockResolvedValue(true);
  readSalesRowFromDb.mockResolvedValue(null);
  readMeetingsFromDb.mockResolvedValue([]);
});

describe("persistProductionCell — 생산(E) DB 정본 전환", () => {
  it("① 파일럿 → DB upsert(정본), 시트 직접 write 없음", async () => {
    await persistProductionCell(pilot, DATE, "매입DB", 5);
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "sales", rowKey: `${DATE}:매입DB`, cohort: "8", email: "u@x.y",
        payload: { date: DATE, channel: "매입DB", production: 5 },
      }),
    );
    expect(writeProductionCell).not.toHaveBeenCalled(); // 시트 정본 경로 미사용
  });

  it("⑥ 콜·지·기·소 → 생산·유입 동시(ADR-0029)", async () => {
    await persistProductionCell(pilot, DATE, "콜·지·기·소", 3);
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { date: DATE, channel: "콜·지·기·소", production: 3, inflow: 3 },
      }),
    );
  });

  it("② 비파일럿(7기) → writeProductionCell 그대로, DB upsert 없음(완전 불변)", async () => {
    await persistProductionCell(nonPilot, DATE, "매입DB", 5);
    expect(writeProductionCell).toHaveBeenCalledWith(SHEET, DATE, "매입DB", 5);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("② DB 꺼짐 → 파일럿도 R2 경로(롤백 스위치)", async () => {
    dbEnabled.mockReturnValue(false);
    await persistProductionCell(pilot, DATE, "매입DB", 5);
    expect(writeProductionCell).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  // ⚠️ 계약 전환 (R4 W1-1 / ADR-0029 G1): 옛 규칙 "창 밖 → DB 에도 안 씀" 은 **폐지**됐다.
  // 옛 규칙의 목적(시트가 못 담는 행이 무필터 집계를 부풀림)은 이제 **집계 클램프**가 담당한다
  // (channelStackingFromDb ≤ MAX_SHEET_WEEK — dashboard-aggregates.test.ts 가 고정).
  // 여기서는 "저장은 되되 시트 미러는 안 탄다"= DB-only 를 고정한다.
  it("③ 창 밖(11주+) → DB 정본은 기록, 시트 미러는 skip (DB-only)", async () => {
    isWithinSalesWindow.mockResolvedValue(false);
    await persistProductionCell(pilot, DATE, "매입DB", 5);
    expect(upsertSheetRow).toHaveBeenCalledTimes(1); // 무제한 쓰기 — 정본은 남는다
    await new Promise((r) => setTimeout(r, 20));
    expect(writeSalesRowCells).not.toHaveBeenCalled(); // 시트 좌표 없음 → 미러 없음
  });

  it("DB 2회 연속 실패 → throw(시트 폴백 금지)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("db down"));
    await expect(persistProductionCell(pilot, DATE, "매입DB", 5)).rejects.toThrow();
    expect(writeProductionCell).not.toHaveBeenCalled(); // 시트로 폴백하지 않음
  });
});

describe("persistMeetingReservationCount — H 는 카드수 절대 재계산(ADR-0010)", () => {
  it("④ 파일럿 → readMeetingsFromDb 로 카드수 재계산 후 절대값 upsert(±1 RMW 아님)", async () => {
    readMeetingsFromDb.mockResolvedValue([
      { 예약일: DATE, channel: "매입DB" },
      { 예약일: DATE, channel: "매입DB" },
      { 예약일: DATE, channel: "현수막" }, // 다른 채널 — 세지 않음
      { 예약일: "2026-04-19", channel: "매입DB" }, // 다른 날짜 — 세지 않음
    ]);
    await persistMeetingReservationCount(pilot, DATE, "매입DB");
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({
        rowKey: `${DATE}:매입DB`,
        payload: { date: DATE, channel: "매입DB", meetingReservation: 2 },
      }),
    );
    expect(decrementMeetingReservation).not.toHaveBeenCalled();
  });

  it("④ 카드 0건 → H=0 절대 기입(부재키 no-op 아님 — 마지막 카드 삭제도 반영)", async () => {
    readMeetingsFromDb.mockResolvedValue([]);
    await persistMeetingReservationCount(pilot, DATE, "매입DB");
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { date: DATE, channel: "매입DB", meetingReservation: 0 } }),
    );
  });

  it("② 비파일럿 → decrementMeetingReservation 그대로(완전 불변)", async () => {
    await persistMeetingReservationCount(nonPilot, DATE, "매입DB");
    expect(decrementMeetingReservation).toHaveBeenCalledWith(SHEET, DATE, "매입DB");
    expect(upsertSheetRow).not.toHaveBeenCalled();
    expect(readMeetingsFromDb).not.toHaveBeenCalled();
  });

  // 계약 전환 (R4 W1-1 / ADR-0029 G1) — 위 persistProductionCell ③ 과 동일 원리.
  it("③ 창 밖(11주+) → DB 정본 기입, 시트 미러 skip (DB-only)", async () => {
    isWithinSalesWindow.mockResolvedValue(false);
    await persistMeetingReservationCount(pilot, DATE, "매입DB");
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(writeSalesRowCells).not.toHaveBeenCalled();
  });
});

describe("⑤ 시트 수렴 미러 — 최신 DB 행을 E:H 로(스냅샷 재생 아님)", () => {
  it("upsert 후 큐가 최신 DB 행을 읽어 시트 E:H 를 쓴다", async () => {
    readSalesRowFromDb.mockResolvedValue({
      date: DATE, channel: "매입DB",
      production: 5, inflow: 2, contactProgress: 3, meetingReservation: 1,
    });
    await persistProductionCell(pilot, DATE, "매입DB", 5);
    await vi.waitFor(() => expect(writeSalesRowCells).toHaveBeenCalled());
    // 인자의 셀 값은 **DB 에서 읽은 최신 행** — 호출 시점 스냅샷이 아님
    expect(writeSalesRowCells).toHaveBeenCalledWith(SHEET, DATE, "매입DB", {
      date: DATE, channel: "매입DB",
      production: 5, inflow: 2, contactProgress: 3, meetingReservation: 1,
    });
  });

  it("DB 에 행이 없으면 시트에 아무것도 안 쓴다", async () => {
    readSalesRowFromDb.mockResolvedValue(null);
    await persistProductionCell(pilot, DATE, "매입DB", 5);
    await vi.waitFor(() => expect(readSalesRowFromDb).toHaveBeenCalled());
    expect(writeSalesRowCells).not.toHaveBeenCalled();
  });
});
