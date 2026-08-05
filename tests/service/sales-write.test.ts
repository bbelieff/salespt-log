/**
 * R3-1 sales 쓰기 정본 + mirror_pending 안전망(§2.2·§7-3) 회귀 (#579 per-row 수렴 구조 기준).
 * 고정하는 계약:
 *   ① 파일럿(DB) = writeSalesRowsToDb 정본 + 행별 수렴 미러(queueSalesRowSync→runSalesRowSync).
 *      미러 성공(편집기간 밖 no-op 포함)→clearMirrorPending·최종 실패→markMirrorPending(+Sentry).
 *   ② 응답은 미러와 무관하게 즉시 성공(정본=DB).
 *   ③ 밀린 다른 pending 행을 drain 으로 재드라이브(이번 저장분 제외), 성공 시 해제.
 *   ④ 비파일럿/미설정 = 시트 정본(batchWrite) — mark/clear/drain 미개입.
 *      🔧 BBE-49(2026-08-05) 예외: 물리 상한(MAX_SHEET_WEEK) 밖 날짜는 비파일럿이라도 DB 로 우회
 *      (시트에 좌표가 없어 batchWrite 가 항상 throw했음 — 수료 후 계속 쓰게 한다는 R4 G1 결정과
 *      모순이라 좁게 수리). 물리한계 "안"에서는 기존 ④ 그대로 완전 불변.
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
const readCourseStart = vi.fn(); // BBE-49: 비파일럿 물리한계 판정용
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
  readCourseStart: (...a: unknown[]) => readCourseStart(...(a as [])), // BBE-49
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
    listMirrorPending, captureServerEvent, captureException, readCourseStart,
  ]) m.mockReset();
  dbEnabled.mockReturnValue(true);
  // BBE-49: mkRow() 기본 날짜(2026-07-15)가 이 courseStart 기준 ~7주차(물리한계 1~10주 안)가 되도록.
  readCourseStart.mockResolvedValue(new Date(2026, 5, 1));
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

  it("비파일럿이라도 물리한계 안(1~10주)이면 완전 불변 — 창 판정 자체를 하지 않고 기존 시트 경로", async () => {
    isWithinSalesWindow.mockResolvedValue(false); // 호출 자체가 안 되는지가 핵심이라 값은 무관
    await persistSalesRows("7", EMAIL, SHEET, [mkRow({ date: "2026-07-15" })]); // courseStart 2026-06-01 기준 ~7주차
    expect(batchWriteChannelDailyRows).toHaveBeenCalledTimes(1); // R2 그대로
    expect(isWithinSalesWindow).not.toHaveBeenCalled();
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
  });

  // 🔧 BBE-49(2026-08-05, 김현지/7기 라이브 P0): 위 테스트와 대칭 짝 — 물리한계 "밖"은 예외적으로 DB.
  // 시트에 애초에 좌표가 없어 batchWriteChannelDailyRows→salesRowFor 가 항상 throw했다(저장 영구실패).
  it("비파일럿이라도 물리한계(11주+) 밖이면 DB 로 우회 — 시트엔 애초에 좌표가 없어 판정도 불필요", async () => {
    await persistSalesRows("7", EMAIL, SHEET, [mkRow({ date: "2026-09-30" })]); // courseStart 기준 ~18주차
    expect(readCourseStart).toHaveBeenCalledWith(SHEET);
    expect(writeSalesRowsToDb).toHaveBeenCalledTimes(1); // 저장 성공(정본=DB)
    expect(batchWriteChannelDailyRows).not.toHaveBeenCalled(); // 시트엔 안 씀(좌표 없음)
    expect(isWithinSalesWindow).not.toHaveBeenCalled(); // 파일럿 11주+ 와 동일하게 미러 자체를 시도 안 함
    expect(markMirrorPending).not.toHaveBeenCalled();
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });

  // 🔧 BBE-49 적대리뷰: DB 킬스위치(DATABASE_URL 미설정)를 이 우회가 새면 client.ts 가
  // "호출부 게이트 오류" 로 500 → 롤백 레버가 무력해진다. 읽기측 loadDay 와 동일 가드.
  it("DB 가 꺼져 있으면 물리한계 밖이라도 DB 로 새지 않는다 — 롤백 레버 보존", async () => {
    dbEnabled.mockReturnValue(false);
    await persistSalesRows("7", EMAIL, SHEET, [mkRow({ date: "2026-09-30" })]);
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
    expect(readCourseStart).not.toHaveBeenCalled(); // 판정 read 조차 하지 않는다
    expect(batchWriteChannelDailyRows).toHaveBeenCalledTimes(1); // 기존 시트 경로(= 기존 좌표 에러)
  });

  it("비파일럿 배치에 날짜가 섞이면 즉시 실패 — 일부 행만 틀린 정본으로 가는 것 차단", async () => {
    await expect(
      persistSalesRows("7", EMAIL, SHEET, [
        mkRow({ date: "2026-07-15" }),
        mkRow({ date: "2026-09-30" }),
      ]),
    ).rejects.toThrow(/한 날짜의 행만/);
    expect(writeSalesRowsToDb).not.toHaveBeenCalled();
    expect(batchWriteChannelDailyRows).not.toHaveBeenCalled();
  });

  // 적대리뷰 M4/M6 — 창 판정은 **시트 read** 다. 정본(DB)은 그 앞에서 이미 커밋됐으므로
  // 시트 장애가 저장 응답을 실패로 만들면 안 된다("저장은 됐는데 사용자에겐 실패" + 나머지 행이
  // 큐·mirror_pending 어디에도 없어 self-heal 영구 누락).
  it("창 판정이 throw 해도 저장은 성공 — 시트 장애가 정본 저장의 인질이 되지 않는다", async () => {
    isWithinSalesWindow.mockRejectedValue(new Error("sheets 429"));
    await expect(
      persistSalesRows("8", EMAIL, SHEET, [mkRow(), mkRow({ channel: "매입DB" })]),
    ).resolves.toBeUndefined();
    expect(writeSalesRowsToDb).toHaveBeenCalledTimes(1); // 정본 저장 성사
  });

  it("판정 throw 시 미러는 큐에 맡긴다(재시도·pending 경로 보유) — 행 유실 없음", async () => {
    isWithinSalesWindow.mockRejectedValue(new Error("sheets 500"));
    await persistSalesRows("8", EMAIL, SHEET, [mkRow()]);
    await vi.waitFor(() => expect(writeSalesRowCells).toHaveBeenCalled());
  });
});
