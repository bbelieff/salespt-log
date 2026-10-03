/**
 * BBE-259 — 03 DB관리 4섹션 append 전용 DB 미러(db-tab-append-mirror.ts) 회귀.
 * contract-append-mirror.test.ts(BBE-248)의 03 판 — mirror.ts 표준(3회/~1.8초)보다 재시도창을
 * 늘려(8회/700ms 배수 ≈25초) BBE-244 급 순간 DB pool 고갈 blip 의 커버리지를 넓힌다.
 * fire-and-forget — 절대 throw 하지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const upsertSheetRow = vi.fn();
const findOwnerBySpreadsheetId = vi.fn(async () => ({ cohort: "8", email: "u@x.y" }));
const captureServerEvent = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  upsertSheetRow: (...a: unknown[]) => upsertSheetRow(...(a as [])),
}));
vi.mock("@/repo/users", () => ({
  findOwnerBySpreadsheetId: (...a: unknown[]) => findOwnerBySpreadsheetId(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));

import { mirrorDbTabRowDurable } from "@/repo/db-tab-append-mirror";

const SHEET = "sheet-1";
const ROW_KEY = "매입DB:uuid-1";
const PAYLOAD = { 구매일: "2026-08-20", 업체명: "가나상사", _row: 12, _cleared: false };

/** 내부 재시도(8회, 700ms 배수 ≈ 25.2초 총합)를 가상 시간으로 전부 소진한다. */
const settle = () => vi.advanceTimersByTimeAsync(30_000);

beforeEach(() => {
  vi.useFakeTimers();
  dbEnabled.mockReset().mockReturnValue(true);
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  findOwnerBySpreadsheetId.mockReset().mockResolvedValue({ cohort: "8", email: "u@x.y" });
  captureServerEvent.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(30_000);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mirrorDbTabRowDurable — fire-and-forget, 절대 throw 안 함", () => {
  it("① 즉시 반환(void), throw 없음", () => {
    expect(() => mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD)).not.toThrow();
    expect(mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD)).toBeUndefined();
  });

  it("② 성공 — 전달받은 rowKey 그대로 upsert 1회(tab='db' 고정)", async () => {
    mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: SHEET,
      tab: "db",
      rowKey: ROW_KEY,
      payload: PAYLOAD,
    });
  });

  it("③ mirror.ts 표준(3회)보다 오래 실패해도 결국 성공 — BBE-244 급 blip 커버리지 확장 증명", async () => {
    upsertSheetRow
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce({ skipped: false });
    mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(6);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("④ 8회 전부 실패 — 포기 후 warn + db_mirror_error(tab=db) 계수(throw 아님)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(8);
    expect(captureServerEvent).toHaveBeenCalledWith("db_mirror_error", { tab: "db" });
  });

  it("⑤ DB 미설정 — 즉시 no-op, upsert 0회", async () => {
    dbEnabled.mockReturnValue(false);
    mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD);
    await settle();
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑥ owner 역조회 실패 — '?'/'' 로 진행(다른 미러 헬퍼와 동일 관용)", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    mirrorDbTabRowDurable(SHEET, ROW_KEY, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "" }),
    );
  });
});
