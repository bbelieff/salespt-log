/**
 * BBE-246 — 02 계약 행 시트 수렴 미러(contract-sheet-sync.ts) 회귀.
 * sales-write.test.ts(§2.2·§7-3) 와 동일 계약을 02 판으로 고정:
 *   ① queueContractRowSync → 최신 DB payload 를 읽어 C:AO 전체 행을 시트에 반영, 성공 시
 *      clearMirrorPending(contracts, r{row}).
 *   ② 시트 반영 최종 실패(3회) → markMirrorPending + captureServerEvent("sheet_mirror_error").
 *   ③ DB 행이 없거나(_cleared 포함) 의미있는 내용이 없으면 시트를 clear(값 쓰기 아님).
 *   ④ 드레인 — 이번 저장분 외 pending 행을 재드라이브.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readContractRowPayload = vi.fn();
const clearMirrorPending = vi.fn();
const markMirrorPending = vi.fn();
const listMirrorPending = vi.fn();
const captureServerEvent = vi.fn();
const valuesBatchUpdate = vi.fn(async () => ({}));
const valuesClear = vi.fn(async () => ({}));
const ensureGridColumns = vi.fn(async () => {});

// dbEnabled=true — 실제 함수는 DATABASE_URL 미설정 시 false 라 drain 이 조용히 no-op 된다
// (테스트 환경엔 DATABASE_URL 이 없다, tests/setup.ts). self-heal 드레인을 검증하려면 필수.
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true }));
vi.mock("@/repo/db/contracts-clear", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/repo/db/contracts-clear")>();
  return {
    ...actual,
    readContractRowPayload: (...a: unknown[]) => readContractRowPayload(...(a as [])),
  };
});
vi.mock("@/repo/db/mirror-pending", () => ({
  clearMirrorPending: (...a: unknown[]) => clearMirrorPending(...(a as [])),
  markMirrorPending: (...a: unknown[]) => markMirrorPending(...(a as [])),
  listMirrorPending: (...a: unknown[]) => listMirrorPending(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: "02 계약수납관리" } }] } }),
      values: { batchUpdate: valuesBatchUpdate, clear: valuesClear },
    },
  }),
  ensureGridColumns: (...a: unknown[]) => ensureGridColumns(...(a as [])),
}));

import { queueContractRowSync } from "@/repo/contract-sheet-sync";

const SHEET = "sheet-1";

/** 계약일/업체명/수임비 열문자 base — read-daily.ts:contractFromDbPayload 가 요구하는 최소 형태. */
function mkDbPayload(o: Record<string, unknown> = {}) {
  return { _cleared: false, 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000, ...o };
}

beforeEach(() => {
  for (const m of [readContractRowPayload, clearMirrorPending, markMirrorPending, listMirrorPending, captureServerEvent, valuesBatchUpdate, valuesClear, ensureGridColumns])
    m.mockReset();
  readContractRowPayload.mockResolvedValue(mkDbPayload());
  clearMirrorPending.mockResolvedValue(undefined);
  markMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
  valuesBatchUpdate.mockResolvedValue({});
  valuesClear.mockResolvedValue({});
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10)); // fire-and-forget 배수
});

describe("queueContractRowSync — 성공", () => {
  it("최신 DB payload 를 C:AO 로 반영 + clearMirrorPending(contracts, r{row})", async () => {
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "contracts", rowKey: "r9" });
    expect(valuesBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: SHEET,
        requestBody: expect.objectContaining({
          data: [expect.objectContaining({ range: "'02 계약수납관리'!C9:AO9" })],
        }),
      }),
    );
    expect(markMirrorPending).not.toHaveBeenCalled();
  });
});

describe("queueContractRowSync — 실패", () => {
  it("시트 반영 3회 실패 → markMirrorPending + sheet_mirror_error 계수", async () => {
    valuesBatchUpdate.mockRejectedValue(new Error("sheets 500"));
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(
      () => expect(markMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "contracts", rowKey: "r9" }),
      { timeout: 3000 },
    );
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "contracts" });
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });
});

describe("삭제·미기록 = 시트 clear", () => {
  it("DB payload 가 _cleared:true 면 값을 쓰지 않고 시트를 clear 한다", async () => {
    readContractRowPayload.mockResolvedValue({ _cleared: true });
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(() => expect(valuesClear).toHaveBeenCalled());
    expect(valuesBatchUpdate).not.toHaveBeenCalled();
    expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "contracts", rowKey: "r9" });
  });

  it("DB 행 자체가 없으면(payload null) 시트를 clear 한다", async () => {
    readContractRowPayload.mockResolvedValue(null);
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(() => expect(valuesClear).toHaveBeenCalled());
    expect(valuesBatchUpdate).not.toHaveBeenCalled();
  });

  it("의미있는 내용이 없으면(계약일·업체명·수임비 전부 공백/0) clear — rowToCP 가드와 동일 기준", async () => {
    readContractRowPayload.mockResolvedValue(mkDbPayload({ 계약일: "", 업체명: "", 수임비: 0 }));
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(() => expect(valuesClear).toHaveBeenCalled());
    expect(valuesBatchUpdate).not.toHaveBeenCalled();
  });
});

describe("드레인 — 밀린 행 self-heal", () => {
  it("이번 저장분 외 pending 행을 최신 DB 로 재드라이브(성공 시 해제)", async () => {
    listMirrorPending.mockResolvedValue(["r3", "r9"]);
    readContractRowPayload.mockImplementation(async (_sid: string, row: number) =>
      mkDbPayload({ 계약일: row === 3 ? "2026-01-01" : "2026-07-10" }),
    );
    queueContractRowSync(SHEET, 9);
    await vi.waitFor(() =>
      expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "contracts", rowKey: "r3" }),
    );
    // 드레인이 pending row 3 도 시트에 반영했다(자기 자신 r9 는 이미 처리 — 중복 없음).
    expect(valuesBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          data: [expect.objectContaining({ range: "'02 계약수납관리'!C3:AO3" })],
        }),
      }),
    );
  });
});
