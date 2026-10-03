/**
 * BBE-248 ③ — contract-append-mirror.ts (append 전용 DB 미러 재시도창 확장).
 *
 * mirror.ts 표준(3회/선형백오프 300·600·900ms ≈ 1.8초)보다 재시도창을 늘려(8회/700ms 배수
 * ≈ 25초) BBE-244 급 순간 DB pool 고갈 blip 의 커버리지를 넓힌다. fire-and-forget — 절대
 * throw 하지 않는다(append 재시도가 findFirstEmptyRow 를 다시 태워 중복행을 만들 수 있어
 * writeContractRow 가 이 경로에 opts.syncDb 를 절대 넘기지 않음, 별도 회귀는 contract-payment.ts
 * 쪽에서 확인).
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

import { mirrorContractRowDurable } from "@/repo/contract-append-mirror";

const SHEET = "sheet-1";
const ROW = 12;
const PAYLOAD = { _cleared: false, 계약일: "2026-08-20", 업체명: "가나상사", 수임비: 1_000_000 };

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

describe("mirrorContractRowDurable — fire-and-forget, 절대 throw 안 함", () => {
  it("① 즉시 반환(void), throw 없음", () => {
    expect(() => mirrorContractRowDurable(SHEET, ROW, PAYLOAD)).not.toThrow();
    expect(mirrorContractRowDurable(SHEET, ROW, PAYLOAD)).toBeUndefined();
  });

  it("② 성공 — r{row} upsert 1회", async () => {
    mirrorContractRowDurable(SHEET, ROW, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
    expect(upsertSheetRow).toHaveBeenCalledWith({
      cohort: "8",
      email: "u@x.y",
      spreadsheetId: SHEET,
      tab: "contracts",
      rowKey: `r${ROW}`,
      payload: PAYLOAD,
    });
  });

  it("③ mirror.ts 표준(3회)보다 오래 실패해도 결국 성공 — BBE-244 급 blip 커버리지 확장 증명", async () => {
    // 5회 연속 실패(표준 3회 재시도창을 넘김) 후 6번째 성공.
    upsertSheetRow
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce({ skipped: false });
    mirrorContractRowDurable(SHEET, ROW, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(6);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("④ 8회 전부 실패 — 포기 후 warn + db_mirror_error 계수(throw 아님)", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    mirrorContractRowDurable(SHEET, ROW, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledTimes(8);
    expect(captureServerEvent).toHaveBeenCalledWith("db_mirror_error", { tab: "contracts" });
  });

  it("⑤ DB 미설정 — 즉시 no-op, upsert 0회", async () => {
    dbEnabled.mockReturnValue(false);
    mirrorContractRowDurable(SHEET, ROW, PAYLOAD);
    await settle();
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑥ owner 역조회 실패 — '?'/'' 로 진행(다른 미러 헬퍼와 동일 관용)", async () => {
    findOwnerBySpreadsheetId.mockRejectedValue(new Error("registry down"));
    mirrorContractRowDurable(SHEET, ROW, PAYLOAD);
    await settle();
    expect(upsertSheetRow).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "?", email: "" }),
    );
  });
});
