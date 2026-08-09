/**
 * BBE-61(R3-4b) — lib/repo/db/mirror.ts 의 mirrorSheetRowAwaitable.
 *
 * mirrorSheetRow(fire-and-forget)와 재시도(선형 백오프 3회)·최종 실패 시 warn+PostHog 는 동일하지만,
 * **호출자가 완료를 기다릴 수 있고**, 그러면서도 **절대 throw 하지 않는다**(성공/실패 boolean 반환) —
 * writeProductionCountCell(생산개수 M)처럼 "이미 성공한 주 동작 위에 얹힌 파생 갱신"이 실패해도
 * 그 주 동작을 에러로 되돌리면 안 되는 호출부 전용.
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

import { mirrorSheetRow, mirrorSheetRowAwaitable } from "@/repo/db/mirror";

const P = { spreadsheetId: "sheet-1", tab: "db" as const, rowKey: "직접생산:r5", payload: { 생산개수: 3 } };

/** 내부 재시도(선형 백오프 300·600·900ms = 최대 1800ms)를 가상 시간으로 소진한다. */
const settle = () => vi.advanceTimersByTimeAsync(2000);

beforeEach(() => {
  vi.useFakeTimers();
  dbEnabled.mockReset().mockReturnValue(true);
  upsertSheetRow.mockReset().mockResolvedValue({ skipped: false });
  findOwnerBySpreadsheetId.mockReset().mockResolvedValue({ cohort: "8", email: "u@x.y" });
  captureServerEvent.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mirrorSheetRowAwaitable — await 가능 + 절대 throw 안 함", () => {
  it("① 성공 — true 반환, upsert 1회", async () => {
    const p = mirrorSheetRowAwaitable(P);
    await settle();
    await expect(p).resolves.toBe(true);
    expect(upsertSheetRow).toHaveBeenCalledTimes(1);
  });

  it("② 1회 실패 후 재시도 성공 — true 반환, 경고 없음", async () => {
    upsertSheetRow.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce({ skipped: false });
    const p = mirrorSheetRowAwaitable(P);
    await settle();
    await expect(p).resolves.toBe(true);
    expect(upsertSheetRow).toHaveBeenCalledTimes(2);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("③ 3회 연속 실패 — throw 없이 false 반환 + warn·PostHog 관측", async () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    const p = mirrorSheetRowAwaitable(P);
    await settle();
    await expect(p).resolves.toBe(false); // throw 아님 — resolve(false)
    expect(upsertSheetRow).toHaveBeenCalledTimes(3);
    expect(captureServerEvent).toHaveBeenCalledWith("db_mirror_error", { tab: "db" });
  });

  it("④ DB 미설정 — 즉시 false, upsert 0회(no-op)", async () => {
    dbEnabled.mockReturnValue(false);
    await expect(mirrorSheetRowAwaitable(P)).resolves.toBe(false);
    expect(upsertSheetRow).not.toHaveBeenCalled();
  });

  it("⑤ mirrorSheetRow(fire-and-forget)는 여전히 동기 void — 호출 즉시 반환, throw 없음", () => {
    upsertSheetRow.mockRejectedValue(new Error("down"));
    expect(() => mirrorSheetRow(P)).not.toThrow();
    expect(mirrorSheetRow(P)).toBeUndefined();
  });
});
