/**
 * BBE-246 — 03 DB관리 행 시트 수렴 미러(db-tab-sheet-sync.ts) 회귀.
 * contract-sheet-sync.test.ts 와 동일 계약을 03 판(4섹션)으로 고정:
 *   ① queueDbTabRowSync → readDbTabFromDb 의 최신 상태를 섹션 컬럼 범위에 반영, 성공 시
 *      clearMirrorPending(db, {섹션}:r{row}) — 테스트 환경은 DATABASE_URL 미설정이라
 *      resolveWriteKey 가 레거시 `{섹션}:r{row}` 로 폴백한다(다른 db-tab 테스트들과 동일 관례).
 *   ② 시트 반영 최종 실패(3회) → markMirrorPending + captureServerEvent.
 *   ③ 그 (섹션,row) 가 readDbTabFromDb 결과에 없으면(삭제·미기록) 시트를 clear.
 *   ④ 드레인 — 레거시 키 형식의 다른 pending 행을 재드라이브.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readDbTabFromDb = vi.fn();
const clearMirrorPending = vi.fn();
const markMirrorPending = vi.fn();
const listMirrorPending = vi.fn();
const captureServerEvent = vi.fn();
const valuesUpdate = vi.fn(async () => ({}));
const valuesClear = vi.fn(async () => ({}));

// dbEnabled=true — 실제 함수는 DATABASE_URL 미설정 시 false 라 drain 이 조용히 no-op 된다
// (테스트 환경엔 DATABASE_URL 이 없다, tests/setup.ts). self-heal 드레인을 검증하려면 필수.
// row-key.ts::resolveWriteKey 도 이 dbEnabled 를 보지만, true 로 만들면 findCurrentRowKey 가
// 실제 DB 쿼리(getDbPool)를 타려 하므로 대신 row-key.ts 자체를 모킹해 항상 레거시 키로 고정한다
// (레거시 키 = 이 파일의 self-heal 이 실제로 다루는 형식이라 테스트 의도와도 일치).
vi.mock("@/repo/db/row-key", () => ({
  resolveWriteKey: async (_sid: string, section: string, row: number) => `${section}:r${row}`,
}));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true }));
vi.mock("@/repo/db/read-db-tab", () => ({
  readDbTabFromDb: (...a: unknown[]) => readDbTabFromDb(...(a as [])),
}));
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
    spreadsheets: { values: { update: valuesUpdate, clear: valuesClear } },
  }),
}));

import { queueDbTabRowSync } from "@/repo/db-tab-sheet-sync";

const SHEET = "sheet-1";

const emptySections = { purchases: [], productions: [], banners: [], leads: [] };
function mkPurchaseRow(row: number, o: Record<string, unknown> = {}) {
  return { 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 3, 부가세여부: false, 기타: "", 주문금액: 3000, row, ...o };
}

beforeEach(() => {
  for (const m of [readDbTabFromDb, clearMirrorPending, markMirrorPending, listMirrorPending, captureServerEvent, valuesUpdate, valuesClear])
    m.mockReset();
  readDbTabFromDb.mockResolvedValue({ ...emptySections, purchases: [mkPurchaseRow(9)] });
  clearMirrorPending.mockResolvedValue(undefined);
  markMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
  valuesUpdate.mockResolvedValue({});
  valuesClear.mockResolvedValue({});
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10)); // fire-and-forget 배수
});

describe("queueDbTabRowSync — 성공", () => {
  it("최신 DB 상태를 섹션 컬럼(B:H)에 반영 + clearMirrorPending(db, 매입DB:r{row})", async () => {
    queueDbTabRowSync(SHEET, "매입DB", 9);
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "db", rowKey: "매입DB:r9" });
    expect(valuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: SHEET,
        range: "'03 DB관리'!B9:H9",
        requestBody: { values: [["2026-07-10", "가나", 1000, 3, false, "", ""]] },
      }),
    );
    expect(markMirrorPending).not.toHaveBeenCalled();
  });
});

describe("queueDbTabRowSync — 실패", () => {
  it("시트 반영 3회 실패 → markMirrorPending + sheet_mirror_error 계수", async () => {
    valuesUpdate.mockRejectedValue(new Error("sheets 500"));
    queueDbTabRowSync(SHEET, "매입DB", 9);
    await vi.waitFor(
      () => expect(markMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "db", rowKey: "매입DB:r9" }),
      { timeout: 3000 },
    );
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "db" });
    expect(clearMirrorPending).not.toHaveBeenCalled();
  });
});

describe("삭제·미기록 = 시트 clear", () => {
  it("readDbTabFromDb 결과에 그 row 가 없으면(삭제됨) 값을 쓰지 않고 시트를 clear 한다", async () => {
    readDbTabFromDb.mockResolvedValue(emptySections); // row 9 삭제됨
    queueDbTabRowSync(SHEET, "매입DB", 9);
    await vi.waitFor(() => expect(valuesClear).toHaveBeenCalledWith({ spreadsheetId: SHEET, range: "'03 DB관리'!B9:H9" }));
    expect(valuesUpdate).not.toHaveBeenCalled();
    expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "db", rowKey: "매입DB:r9" });
  });
});

describe("섹션별 컬럼 범위 — 4섹션 모두", () => {
  it("직접생산 = I:O", async () => {
    readDbTabFromDb.mockResolvedValue({
      ...emptySections,
      productions: [{ 시작일: "2026-07-01", 종료일: "2026-07-10", 소재: "블로그", 기간예산: 100000, 생산개수: 5, 부가세여부: false, 기타: "", 개당단가: 20000, row: 3 }],
    });
    queueDbTabRowSync(SHEET, "직접생산", 3);
    await vi.waitFor(() => expect(valuesUpdate).toHaveBeenCalled());
    expect(valuesUpdate).toHaveBeenCalledWith(expect.objectContaining({ range: "'03 DB관리'!I3:O3" }));
  });

  it("현수막 = P:W", async () => {
    readDbTabFromDb.mockResolvedValue({
      ...emptySections,
      banners: [{ 날짜: "2026-07-01", 업체명: "현수막사", 도착일: "2026-07-05", 개당단가: 500, 주문개수: 2, 부가세여부: true, 기타: "", 주문금액: 1000, row: 5 }],
    });
    queueDbTabRowSync(SHEET, "현수막", 5);
    await vi.waitFor(() => expect(valuesUpdate).toHaveBeenCalled());
    expect(valuesUpdate).toHaveBeenCalledWith(expect.objectContaining({ range: "'03 DB관리'!P5:W5" }));
  });

  it("콜지기소 = X:AD", async () => {
    readDbTabFromDb.mockResolvedValue({
      ...emptySections,
      leads: [{ 구분: "콜", 접수일: "2026-07-01", 대표자명: "김대표", 업체명: "가나", 소개처: "", 연락처: "010", 조건: "", 발굴id: "u1", row: 7 }],
    });
    queueDbTabRowSync(SHEET, "콜지기소", 7);
    await vi.waitFor(() => expect(valuesUpdate).toHaveBeenCalled());
    expect(valuesUpdate).toHaveBeenCalledWith(expect.objectContaining({ range: "'03 DB관리'!X7:AD7" }));
  });
});

describe("드레인 — 레거시 키(mirror_pending) self-heal", () => {
  it("이번 저장분 외 pending 행(레거시 {섹션}:r{row})을 최신 DB 로 재드라이브", async () => {
    listMirrorPending.mockResolvedValue(["매입DB:r3", "매입DB:r9"]);
    readDbTabFromDb.mockResolvedValue({ ...emptySections, purchases: [mkPurchaseRow(3), mkPurchaseRow(9)] });
    queueDbTabRowSync(SHEET, "매입DB", 9);
    await vi.waitFor(() =>
      expect(clearMirrorPending).toHaveBeenCalledWith({ spreadsheetId: SHEET, tab: "db", rowKey: "매입DB:r3" }),
    );
    expect(valuesUpdate).toHaveBeenCalledWith(expect.objectContaining({ range: "'03 DB관리'!B3:H3" }));
  });
});
