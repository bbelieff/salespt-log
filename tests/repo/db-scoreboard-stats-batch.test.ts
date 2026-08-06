/**
 * BBE-63(R7 Phase 3 #14) — readScoreboardRowsFromDbBatch 배치 조회 회귀.
 * profile-stats.ts(BBE-64)의 배치 read 패턴과 동일 — sales·meetings·contracts 3쿼리를
 * spreadsheetId 별로 분배해 Map 으로 반환하는지, 부부/멀티계정(같은 sheetId) 이 뒤섞이지
 * 않는지, 요청한 모든 id 가 빈 항목이라도 항상 포함되는지 확인.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => true,
  ensureSchema: vi.fn(async () => {}),
  getDbPool: () => ({ query: (...a: unknown[]) => query(...(a as [])) }),
}));

import { readScoreboardRowsFromDbBatch } from "@/repo/db/scoreboard-stats";

beforeEach(() => query.mockReset());

describe("readScoreboardRowsFromDbBatch", () => {
  it("빈 목록 → 쿼리 0회, 빈 Map", async () => {
    const out = await readScoreboardRowsFromDbBatch([]);
    expect(out.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("요청한 모든 id 는 결과가 없어도 항상 항목을 갖는다({salesRows:[],meetings:[],contracts:[]})", async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // sales
      .mockResolvedValueOnce({ rows: [] }) // meetings
      .mockResolvedValueOnce({ rows: [] }); // contracts
    const out = await readScoreboardRowsFromDbBatch(["sheet-1", "sheet-2"]);
    expect(out.get("sheet-1")).toEqual({ salesRows: [], meetings: [], contracts: [] });
    expect(out.get("sheet-2")).toEqual({ salesRows: [], meetings: [], contracts: [] });
  });

  it("spreadsheet_id 별로 정확히 분배 — 다른 시트 행이 섞이지 않는다", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { spreadsheet_id: "sheet-1", payload: { date: "2026-06-02", channel: "매입DB", production: 5, inflow: 2, contactProgress: 1, meetingReservation: 0 } },
          { spreadsheet_id: "sheet-2", payload: { date: "2026-06-03", channel: "현수막", production: 9, inflow: 0, contactProgress: 0, meetingReservation: 0 } },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // meetings
      .mockResolvedValueOnce({ rows: [] }); // contracts
    const out = await readScoreboardRowsFromDbBatch(["sheet-1", "sheet-2"]);
    expect(out.get("sheet-1")!.salesRows).toEqual([
      { date: "2026-06-02", channel: "매입DB", production: 5, inflow: 2, contactProgress: 1, meetingReservation: 0 },
    ]);
    expect(out.get("sheet-2")!.salesRows).toEqual([
      { date: "2026-06-03", channel: "현수막", production: 9, inflow: 0, contactProgress: 0, meetingReservation: 0 },
    ]);
  });

  it("contracts — row_key(r{N})에서 행번호 파생 + 헤더존 정크 제외 + 행번호 오름차순 정렬", async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // sales
      .mockResolvedValueOnce({ rows: [] }) // meetings
      .mockResolvedValueOnce({
        rows: [
          { spreadsheet_id: "sheet-1", row_key: "r9", payload: { 계약일: "2026-06-05", 업체명: "나" } },
          { spreadsheet_id: "sheet-1", row_key: "r6", payload: { 계약일: "2026-06-01", 업체명: "가" } },
          // 헤더존 정크: _backfill=true 인데 계약일이 날짜 형식이 아님 → 제외
          { spreadsheet_id: "sheet-1", row_key: "r3", payload: { _backfill: true, 계약일: "수납총액", 업체명: "안내" } },
        ],
      });
    const out = await readScoreboardRowsFromDbBatch(["sheet-1"]);
    const rows = out.get("sheet-1")!.contracts;
    expect(rows.map((r) => r.row)).toEqual([6, 9]); // 오름차순, 정크(r3) 제외
  });

  it("모든 쿼리에 spreadsheet_id = any($1) 파라미터로 요청 id 배열이 전달된다", async () => {
    query.mockResolvedValue({ rows: [] });
    await readScoreboardRowsFromDbBatch(["sheet-1", "sheet-2"]);
    expect(query).toHaveBeenCalledTimes(3);
    for (const call of query.mock.calls) {
      expect(call[1]).toEqual([["sheet-1", "sheet-2"]]);
    }
  });
});
