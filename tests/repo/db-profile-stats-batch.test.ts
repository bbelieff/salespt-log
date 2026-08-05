/**
 * BBE-64 — `readProfileStatsRowsFromDbBatch` (lib/repo/db/profile-stats.ts).
 * raw-pg-mock 컨벤션(tests/repo/expense-category-lifecycle-r6.test.ts 와 동일 형태) —
 * vi.hoisted 로 가짜 pool 을 만들고 SQL 접두어로 응답을 매칭한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  let salesRows: { spreadsheet_id: string; payload: Record<string, unknown> }[] = [];
  let meetingRows: { spreadsheet_id: string; payload: Record<string, unknown> }[] = [];
  const answer = (sql: string) => {
    const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (q.includes("tab = 'sales'")) return { rows: salesRows, rowCount: salesRows.length };
    if (q.includes("tab = 'meetings'")) return { rows: meetingRows, rowCount: meetingRows.length };
    return { rows: [], rowCount: 0 };
  };
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    return answer(sql);
  });
  return {
    queries,
    query,
    pool: { query },
    setSalesRows: (v: typeof salesRows) => { salesRows = v; },
    setMeetingRows: (v: typeof meetingRows) => { meetingRows = v; },
  };
});

vi.mock("@/repo/db/client", () => ({
  dbEnabled: vi.fn(() => true),
  ensureSchema: vi.fn(async () => {}),
  getDbPool: () => db.pool,
}));

import { readProfileStatsRowsFromDbBatch } from "@/repo/db/profile-stats";

beforeEach(() => {
  db.queries.length = 0;
  db.query.mockClear();
  db.setSalesRows([]);
  db.setMeetingRows([]);
});

describe("readProfileStatsRowsFromDbBatch", () => {
  it("빈 배열 → 쿼리 0회, 빈 Map", async () => {
    const out = await readProfileStatsRowsFromDbBatch([]);
    expect(out.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("요청한 모든 id 에 항목이 생긴다 — DB 행이 0건인 id 도 빈 배열로(부재 아님)", async () => {
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a", "sheet-b"]);
    expect(out.get("sheet-a")).toEqual({ salesRows: [], meetings: [] });
    expect(out.get("sheet-b")).toEqual({ salesRows: [], meetings: [] });
  });

  it("두 쿼리 모두 spreadsheet_id = any($1) 로 배치 조회한다", async () => {
    await readProfileStatsRowsFromDbBatch(["sheet-a", "sheet-b"]);
    const sql = db.queries.map((q) => q.sql.replace(/\s+/g, " ").toLowerCase());
    expect(sql.filter((s) => s.includes("spreadsheet_id = any($1)")).length).toBe(2);
    expect(sql.some((s) => s.includes("tab = 'sales'"))).toBe(true);
    expect(sql.some((s) => s.includes("tab = 'meetings'"))).toBe(true);
    expect(db.queries[0]!.params?.[0]).toEqual(["sheet-a", "sheet-b"]);
  });

  it("sales/meetings 행을 spreadsheet_id 별로 그룹핑해 반환", async () => {
    db.setSalesRows([
      { spreadsheet_id: "sheet-a", payload: { date: "2026-06-01", channel: "매입DB", meetingReservation: 3 } },
      { spreadsheet_id: "sheet-b", payload: { date: "2026-06-01", channel: "매입DB", meetingReservation: 1 } },
    ]);
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a", "sheet-b"]);
    expect(out.get("sheet-a")!.salesRows).toHaveLength(1);
    expect(out.get("sheet-a")!.salesRows[0]!.meetingReservation).toBe(3);
    expect(out.get("sheet-b")!.salesRows[0]!.meetingReservation).toBe(1);
  });

  it("_cleared 행은 SQL where 절에서 제외 조건이 걸린다 (readMeetingsFromDb 와 동일 컨벤션)", async () => {
    await readProfileStatsRowsFromDbBatch(["sheet-a"]);
    const sql = db.queries.map((q) => q.sql.replace(/\s+/g, " ").toLowerCase());
    for (const s of sql) {
      expect(s).toContain("coalesce((payload->>'_cleared')::boolean, false) = false");
    }
  });

  it("meetingFromDbPayload 가 null 을 반환하는 손상 payload 는 조용히 건너뛴다", async () => {
    db.setMeetingRows([
      { spreadsheet_id: "sheet-a", payload: {} }, // id 없음 + 열문자 복원도 실패 예상 → null
    ]);
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a"]);
    expect(out.get("sheet-a")!.meetings).toEqual([]);
  });

  // 적대적 리뷰(2026-08-06) — readSalesRowsFromDb(client.ts)와 "동일 필터 규칙"이라는
  // 이 파일 헤더 주석이 실제로 참이 되도록 고정.
  it("date 가 10자보다 길면(오염된 타임스탬프 등) YYYY-MM-DD 로 자른다 — client.ts:toNum 과 동일", async () => {
    db.setSalesRows([
      { spreadsheet_id: "sheet-a", payload: { date: "2026-06-01T09:00:00.000Z", channel: "매입DB", meetingReservation: 5 } },
    ]);
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a"]);
    expect(out.get("sheet-a")!.salesRows[0]!.date).toBe("2026-06-01");
  });

  it("date 또는 channel 이 빈 값인 sales 행은 제외한다 — readSalesRowsFromDb 와 동일", async () => {
    db.setSalesRows([
      { spreadsheet_id: "sheet-a", payload: { date: "", channel: "매입DB", meetingReservation: 9 } },
      { spreadsheet_id: "sheet-a", payload: { date: "2026-06-01", channel: "", meetingReservation: 9 } },
      { spreadsheet_id: "sheet-a", payload: { date: "2026-06-01", channel: "매입DB", meetingReservation: 2 } },
    ]);
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a"]);
    expect(out.get("sheet-a")!.salesRows).toHaveLength(1);
    expect(out.get("sheet-a")!.salesRows[0]!.meetingReservation).toBe(2);
  });

  it("meetingReservation 이 비정상값(NaN/Infinity 유발 문자열)이면 0 으로 떨어진다", async () => {
    db.setSalesRows([
      { spreadsheet_id: "sheet-a", payload: { date: "2026-06-01", channel: "매입DB", meetingReservation: "abc" } },
    ]);
    const out = await readProfileStatsRowsFromDbBatch(["sheet-a"]);
    expect(out.get("sheet-a")!.salesRows[0]!.meetingReservation).toBe(0);
  });

  it("dbEnabled() false 면 표준 게이트 메시지로 throw", async () => {
    const { dbEnabled } = await import("@/repo/db/client");
    vi.mocked(dbEnabled).mockReturnValueOnce(false);
    await expect(readProfileStatsRowsFromDbBatch(["sheet-a"])).rejects.toThrow(
      "DATABASE_URL 미설정",
    );
  });
});
