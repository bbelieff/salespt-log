/**
 * BBE-59(R7-#10 Phase 1) 회귀 — readDbTabFromDb 의 행번호 결정.
 *
 * 신규 append(이 PR 이후) 는 row_key 가 `{섹션}:{uuid}` 라 옛 파싱(`row_key.replace(/^.*:r/, "")`)
 * 이 NaN 을 낸다(uuid 말미가 숫자가 아님) — NaN 이 화면에 노출되면 그 행 수정/삭제가 깨진다.
 * 수정: payload._row(신규 append 가 명시 기록) 를 우선 신뢰, 없으면(레거시 행) 기존 파싱.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => true,
  ensureSchema: vi.fn(async () => {}),
  getDbPool: () => ({ query: (...a: unknown[]) => query(...(a as [])) }),
}));

import { readDbTabFromDb } from "@/repo/db/read-db-tab";

beforeEach(() => query.mockReset());

describe("readDbTabFromDb — row 번호 결정(레거시 vs 신규 UUID 키)", () => {
  it("레거시 키(`매입DB:r9`) — payload._row 없음 → row_key 말미 파싱(기존 동작 불변)", async () => {
    query.mockResolvedValue({
      rows: [{
        row_key: "매입DB:r9",
        payload: { 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 1, 기타: "", 부가세여부: false, _cleared: false },
      }],
    });
    const { purchases } = await readDbTabFromDb("sheet-1");
    expect(purchases[0]?.row).toBe(9);
  });

  it("신규 UUID 키(`매입DB:abc-uuid`) — row_key 파싱은 NaN 이 나올 자리, payload._row 로 정확히 복원", async () => {
    query.mockResolvedValue({
      rows: [{
        row_key: "매입DB:abc-uuid-not-numeric",
        payload: { 구매일: "2026-07-10", 업체명: "가나", 개당단가: 1000, 주문개수: 1, 기타: "", 부가세여부: false, _cleared: false, _row: 12 },
      }],
    });
    const { purchases } = await readDbTabFromDb("sheet-1");
    expect(purchases[0]?.row).toBe(12);
    expect(purchases[0]?.row).not.toBeNaN();
  });

  it("_row 가 0/음수/비정상이면 무시하고 레거시 파싱으로 폴백(방어)", async () => {
    query.mockResolvedValue({
      rows: [{
        row_key: "직접생산:r7",
        payload: { 시작일: "2026-07-01", 종료일: "2026-08-01", 소재: "x", 기간예산: 1000, 생산개수: 1, 부가세여부: false, 기타: "", _cleared: false, _row: 0 },
      }],
    });
    const { productions } = await readDbTabFromDb("sheet-1");
    expect(productions[0]?.row).toBe(7);
  });
});
