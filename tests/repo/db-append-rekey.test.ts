/**
 * BBE-59(R7-#10 Phase 1) — lib/repo/db.ts append/update/clear 의 row_key 조회·발급 통합.
 *
 *  ① append 4경로 — mintRowKey 로 발급한 UUID 키를 미러 rowKey 로 쓰고, payload 에 _row 를 명시.
 *  ② update/clear — resolveWriteKey 로 조회한 키를 그대로 persistDbRow/clearDbRow 에 전달
 *     (레거시 키 폴백이든 신규 uuid 키든 db.ts 는 판단하지 않고 그대로 위임 — 핵심 회귀:
 *     "행 재사용 시 옛 필드 잔존" 은 resolveWriteKey 가 그 물리 행의 **현재** 키를 정확히
 *     짚어야 안 생긴다. 여기선 db.ts 가 조회 결과를 그대로 쓰는지만 검증하고, 조회 자체의
 *     정확성은 db-row-key.test.ts 가 SQL 레벨로 검증한다).
 *  ③ writeProductionCountCell(생산개수 M) 도 동일하게 resolveWriteKey 경유(기존 정적 키 고정 시
 *     UUID 행에 유령 행이 생기는 회귀 방지).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";

const valuesGet = vi.fn(async () => ({ data: { values: [[]] } })); // phantom → row=FIRST_DATA_ROW
const valuesUpdate = vi.fn(async () => ({}));
const valuesClear = vi.fn(async () => ({}));
const mirrorSheetRow = vi.fn();
const mirrorDbTabRowDurable = vi.fn();
const persistDbRow = vi.fn();
const clearDbRow = vi.fn();
const mintRowKey = vi.fn((section: string) => `${section}:minted-uuid`);
const resolveWriteKey = vi.fn(async (_sid: string, section: string, row: number) => `${section}:resolved-for-${row}`);

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: { values: { get: valuesGet, update: valuesUpdate, clear: valuesClear } },
  }),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (...a: unknown[]) => mirrorSheetRow(...(a as [])),
  mirrorClearRow: vi.fn(),
}));
// BBE-259: append 4경로는 mirror.ts 표준이 아니라 전용 durable 미러(db-tab-append-mirror.ts)를 쓴다.
vi.mock("@/repo/db-tab-append-mirror", () => ({
  mirrorDbTabRowDurable: (...a: unknown[]) => mirrorDbTabRowDurable(...(a as [])),
}));
vi.mock("@/repo/db/db-tab-sync", () => ({
  persistDbRow: (...a: unknown[]) => persistDbRow(...(a as [])),
  clearDbRow: (...a: unknown[]) => clearDbRow(...(a as [])),
}));
vi.mock("@/repo/db/row-key", () => ({
  mintRowKey: (...a: unknown[]) => mintRowKey(...(a as [Parameters<typeof mintRowKey>[0]])),
  resolveWriteKey: (...a: unknown[]) =>
    resolveWriteKey(...(a as Parameters<typeof resolveWriteKey>)),
}));

import {
  appendBanner,
  appendLead,
  appendProduction,
  appendPurchase,
  clearPurchase,
  updateBanner,
  updateLead,
  updateProduction,
  updatePurchase,
} from "@/repo/db";
import { writeProductionCountCell } from "@/repo/db-production-cell";

const P: DBPurchase = {
  구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3,
  주문금액: 3000, 기타: "", 부가세여부: false,
};
const PROD: DBProduction = {
  시작일: "2026-07-01", 종료일: "2026-08-01", 소재: "블로그", 기간예산: 100000,
  생산개수: 0, 개당단가: 0, 부가세여부: false, 기타: "",
};
const B: DBBanner = {
  날짜: "2026-07-10", 업체명: "다라", 도착일: "2026-07-15", 개당단가: 500,
  주문개수: 2, 주문금액: 1000, 부가세여부: false, 기타: "",
};
const L: DBLead = {
  구분: "전화", 접수일: "2026-07-10", 대표자명: "김", 업체명: "마바", 소개처: "", 연락처: "", 조건: "",
};

beforeEach(() => {
  valuesGet.mockReset().mockResolvedValue({ data: { values: [[]] } });
  valuesUpdate.mockReset().mockResolvedValue({});
  valuesClear.mockReset().mockResolvedValue({});
  mirrorSheetRow.mockReset();
  mirrorDbTabRowDurable.mockReset();
  persistDbRow.mockReset();
  clearDbRow.mockReset();
  mintRowKey.mockReset().mockImplementation((section: string) => `${section}:minted-uuid`);
  resolveWriteKey.mockReset().mockImplementation(
    async (_sid: string, section: string, row: number) => `${section}:resolved-for-${row}`,
  );
});

describe("append 4경로 — UUID 키 발급 + _row 명시(신규 append, 레거시 키 미사용)", () => {
  // BBE-259: 미러는 이제 mirrorDbTabRowDurable(spreadsheetId, rowKey, payload) — 위치 인자 3개.
  it("appendPurchase", async () => {
    await appendPurchase("sheet-1", P);
    expect(mintRowKey).toHaveBeenCalledWith("매입DB");
    const [sid, rowKey, payload] = mirrorDbTabRowDurable.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(sid).toBe("sheet-1");
    expect(rowKey).toBe("매입DB:minted-uuid");
    expect(payload._row).toBeTypeOf("number");
    expect(payload._cleared).toBe(false);
    expect(mirrorSheetRow).not.toHaveBeenCalled(); // 공용 mirror.ts 는 append 경로에서 더는 안 쓴다
  });

  it("appendProduction", async () => {
    await appendProduction("sheet-1", PROD);
    expect(mintRowKey).toHaveBeenCalledWith("직접생산");
    const [, rowKey, payload] = mirrorDbTabRowDurable.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(rowKey).toBe("직접생산:minted-uuid");
    expect(payload._row).toBeTypeOf("number");
  });

  it("appendBanner", async () => {
    await appendBanner("sheet-1", B);
    expect(mintRowKey).toHaveBeenCalledWith("현수막");
    const [, rowKey, payload] = mirrorDbTabRowDurable.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(rowKey).toBe("현수막:minted-uuid");
    expect(payload._row).toBeTypeOf("number");
  });

  it("appendLead", async () => {
    await appendLead("sheet-1", L);
    expect(mintRowKey).toHaveBeenCalledWith("콜지기소");
    const [, rowKey, payload] = mirrorDbTabRowDurable.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(rowKey).toBe("콜지기소:minted-uuid");
    expect(payload._row).toBeTypeOf("number");
  });
});

describe("update — resolveWriteKey 로 조회한 키를 그대로 persistDbRow 에 위임", () => {
  it("updatePurchase — 조회 결과 키(신규 uuid 라도)를 그대로 사용, _row 도 함께 기록", async () => {
    await updatePurchase("sheet-1", 9, P, { syncDb: true });
    expect(resolveWriteKey).toHaveBeenCalledWith("sheet-1", "매입DB", 9);
    const [, rowKey, payload] = persistDbRow.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(rowKey).toBe("매입DB:resolved-for-9"); // 목이 신규 키를 돌려줘도 그대로 위임(db.ts 무판단)
    expect(payload._row).toBe(9);
  });

  it("updateProduction/updateBanner/updateLead 도 동일 위임", async () => {
    await updateProduction("sheet-1", 5, PROD, { syncDb: true });
    expect(persistDbRow).toHaveBeenLastCalledWith(
      "sheet-1", "직접생산:resolved-for-5", expect.objectContaining({ _row: 5 }), { syncDb: true },
    );
    await updateBanner("sheet-1", 7, B, { syncDb: true });
    expect(persistDbRow).toHaveBeenLastCalledWith(
      "sheet-1", "현수막:resolved-for-7", expect.objectContaining({ _row: 7 }), { syncDb: true },
    );
    await updateLead("sheet-1", 4, L, { syncDb: true });
    expect(persistDbRow).toHaveBeenLastCalledWith(
      "sheet-1", "콜지기소:resolved-for-4", expect.objectContaining({ _row: 4 }), { syncDb: true },
    );
  });
});

describe("clear — resolveWriteKey 로 조회한 키를 그대로 clearDbRow 에 위임", () => {
  it("clearPurchase", async () => {
    await clearPurchase("sheet-1", 9, { syncDb: true });
    expect(resolveWriteKey).toHaveBeenCalledWith("sheet-1", "매입DB", 9);
    expect(clearDbRow).toHaveBeenCalledWith("sheet-1", "매입DB:resolved-for-9", { syncDb: true });
  });
});

describe("writeProductionCountCell(생산개수 M) — 유령행 방지(BBE-59 회귀)", () => {
  it("resolveWriteKey 로 조회한 키에 병합 — 레거시 고정키였다면 신규(uuid) 행엔 유령행이 생겼을 사례", async () => {
    await writeProductionCountCell("sheet-1", 5, 12);
    expect(resolveWriteKey).toHaveBeenCalledWith("sheet-1", "직접생산", 5);
    expect(mirrorSheetRow).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      tab: "db",
      rowKey: "직접생산:resolved-for-5",
      payload: { 생산개수: 12 },
    });
  });
});
