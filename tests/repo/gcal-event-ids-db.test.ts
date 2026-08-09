/**
 * BBE-62(R7 Phase 2 #13) — gcal 이벤트ID 맵 DB 정본 전환 회귀.
 *
 * 최대 위험은 **지울 수 없는 고아 캘린더 이벤트**다(카드가 지목). `removeAll`(gcal-sync)은
 * `readGcalMap` 이 준 맵을 순회해 이벤트를 지우므로, 맵이 비면 **아무것도 못 지운다**.
 * 그래서 전환기 병합 규칙(시트 ∪ DB, 키 단위 DB 우선, ""=tombstone)을 최우선으로 박제한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const readGcalMapFromDb = vi.fn();
const readGcalMapsFromDbBatch = vi.fn();
const upsertGcalEventId = vi.fn();
const backfillGcalMapIfAbsent = vi.fn();
const tombstoneAllInDb = vi.fn();
const keepOnlyMarkersInDb = vi.fn();
const valuesGet = vi.fn();
const valuesUpdate = vi.fn();
const valuesBatchGet = vi.fn();
const ensureGridColumns = vi.fn();

vi.mock("@/repo/db/client", () => ({ dbEnabled: () => dbEnabled() }));
vi.mock("@/repo/db/gcal-event-ids-db", () => ({
  readGcalMapFromDb: (...a: unknown[]) => readGcalMapFromDb(...(a as [])),
  readGcalMapsFromDbBatch: (...a: unknown[]) => readGcalMapsFromDbBatch(...(a as [])),
  upsertGcalEventId: (...a: unknown[]) => upsertGcalEventId(...(a as [])),
  backfillGcalMapIfAbsent: (...a: unknown[]) => backfillGcalMapIfAbsent(...(a as [])),
  tombstoneAllInDb: (...a: unknown[]) => tombstoneAllInDb(...(a as [])),
  keepOnlyMarkersInDb: (...a: unknown[]) => keepOnlyMarkersInDb(...(a as [])),
}));
vi.mock("@/repo/sheets-client", () => ({
  ensureGridColumns: (...a: unknown[]) => ensureGridColumns(...(a as [])),
  sheetsClient: () => ({
    spreadsheets: {
      values: {
        get: (...a: unknown[]) => valuesGet(...(a as [])),
        update: (...a: unknown[]) => valuesUpdate(...(a as [])),
        batchGet: (...a: unknown[]) => valuesBatchGet(...(a as [])),
      },
    },
  }),
}));

import {
  clearGcalCell,
  keepOnlyMarkers,
  mergeGcalMaps,
  readGcalMap,
  readGcalStates,
  setGcalEventId,
  EXCLUDE_MARKER,
} from "@/repo/gcal-event-ids";

const SID = "sheet-1";
const ID = "m-1";
const ME = "me@x.y";
const SPOUSE = "spouse@x.y";

/** A열 조회 → 행 발견, 그 다음 맵 셀 조회 순서로 응답하는 시트 목. */
function mockSheet(cellValue: string, idColumn: string[] = [ID]) {
  valuesGet.mockReset();
  valuesGet
    .mockResolvedValueOnce({ data: { values: idColumn.map((v) => [v]) } }) // findRow(A2:A)
    .mockResolvedValueOnce({ data: { values: [[cellValue]] } }); // readCell
}

beforeEach(() => {
  dbEnabled.mockReset().mockReturnValue(true);
  readGcalMapFromDb.mockReset().mockResolvedValue({});
  readGcalMapsFromDbBatch.mockReset().mockResolvedValue(new Map());
  upsertGcalEventId.mockReset().mockResolvedValue(undefined);
  backfillGcalMapIfAbsent.mockReset().mockResolvedValue(undefined);
  tombstoneAllInDb.mockReset().mockResolvedValue(undefined);
  keepOnlyMarkersInDb.mockReset().mockResolvedValue(undefined);
  valuesGet.mockReset();
  valuesUpdate.mockReset().mockResolvedValue({});
  valuesBatchGet.mockReset();
  ensureGridColumns.mockReset().mockResolvedValue(undefined);
});

describe("mergeGcalMaps — 병합 규칙(순수함수)", () => {
  it("시트에만 있는 키는 살아남는다(미이전 사용자)", () => {
    expect(mergeGcalMaps({ [ME]: "ev1" }, {})).toEqual({ [ME]: "ev1" });
  });
  it("같은 키는 DB 가 이긴다", () => {
    expect(mergeGcalMaps({ [ME]: "old" }, { [ME]: "new" })).toEqual({ [ME]: "new" });
  });
  it("🔒 DB tombstone('')은 시트 잔재를 이긴다 — 지운 이벤트가 되살아나지 않는다", () => {
    expect(mergeGcalMaps({ [ME]: "ev1" }, { [ME]: "" })).toEqual({});
  });
  it("멀티계정 — 각자 키가 독립 보존된다", () => {
    expect(mergeGcalMaps({ [ME]: "ev1", [SPOUSE]: "ev2" }, { [ME]: "ev1b" })).toEqual({
      [ME]: "ev1b",
      [SPOUSE]: "ev2",
    });
  });
  it("제외 마커도 DB 값으로 덮인다", () => {
    expect(mergeGcalMaps({ [ME]: "ev1" }, { [ME]: EXCLUDE_MARKER })).toEqual({
      [ME]: EXCLUDE_MARKER,
    });
  });
});

describe("readGcalMap — 정본 병합 + lazy backfill", () => {
  it("🔒 DB 가 비어도 시트 값을 돌려준다 — removeAll 이 이벤트를 못 지우는 고아 사고 방지", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1" }));
    readGcalMapFromDb.mockResolvedValue({});
    expect(await readGcalMap(SID, "meeting", ID)).toEqual({ [ME]: "ev1" });
  });

  it("시트에만 있던 키를 DB 로 1회 이전한다", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1", [SPOUSE]: "ev2" }));
    readGcalMapFromDb.mockResolvedValue({ [ME]: "ev1" }); // 배우자 키만 미이전
    await readGcalMap(SID, "meeting", ID);
    await new Promise((r) => setImmediate(r));
    expect(backfillGcalMapIfAbsent).toHaveBeenCalledWith(SID, "meeting", ID, { [SPOUSE]: "ev2" });
  });

  it("DB 조회 실패 시 시트 단독으로 계속(캘린더가 DB 장애로 멈추지 않는다)", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1" }));
    readGcalMapFromDb.mockRejectedValue(new Error("db down"));
    expect(await readGcalMap(SID, "meeting", ID)).toEqual({ [ME]: "ev1" });
  });

  it("DB 미설정 — 시트 단독, DB 호출 0", async () => {
    dbEnabled.mockReturnValue(false);
    mockSheet(JSON.stringify({ [ME]: "ev1" }));
    expect(await readGcalMap(SID, "meeting", ID)).toEqual({ [ME]: "ev1" });
    expect(readGcalMapFromDb).not.toHaveBeenCalled();
  });
});

describe("쓰기 — DB 정본 + 시트 미러", () => {
  it("setGcalEventId — DB upsert 후 시트 미러", async () => {
    mockSheet("");
    await setGcalEventId(SID, "meeting", ID, ME, "ev9");
    expect(upsertGcalEventId).toHaveBeenCalledWith(SID, "meeting", ID, ME, "ev9");
    expect(valuesUpdate).toHaveBeenCalled();
  });

  it("🔒 eventId=null(키 제거)은 DELETE 가 아니라 tombstone('')으로 기록", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1" }));
    await setGcalEventId(SID, "meeting", ID, ME, null);
    expect(upsertGcalEventId).toHaveBeenCalledWith(SID, "meeting", ID, ME, "");
  });

  it("시트 미러 실패는 저장 실패가 아니다(DB 정본)", async () => {
    valuesGet.mockRejectedValue(new Error("sheets 429"));
    await expect(setGcalEventId(SID, "meeting", ID, ME, "ev9")).resolves.toBeUndefined();
    expect(upsertGcalEventId).toHaveBeenCalledTimes(1);
  });

  it("DB 미설정에서는 시트 실패를 삼키지 않는다", async () => {
    dbEnabled.mockReturnValue(false);
    valuesGet.mockRejectedValue(new Error("sheets 429"));
    await expect(setGcalEventId(SID, "meeting", ID, ME, "ev9")).rejects.toThrow();
  });

  it("clearGcalCell — 전 키 tombstone + 시트 셀 비움", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1" }));
    await clearGcalCell(SID, "meeting", ID);
    expect(tombstoneAllInDb).toHaveBeenCalledWith(SID, "meeting", ID);
  });

  it("keepOnlyMarkers — 마커만 남기고 실제 ID 는 tombstone", async () => {
    mockSheet(JSON.stringify({ [ME]: "ev1", [SPOUSE]: EXCLUDE_MARKER }));
    await keepOnlyMarkers(SID, "meeting", ID);
    expect(keepOnlyMarkersInDb).toHaveBeenCalledWith(SID, "meeting", ID, EXCLUDE_MARKER);
  });
});

describe("readGcalStates — 배치 토글 상태", () => {
  it("DB 마커가 시트보다 우선한다", async () => {
    valuesBatchGet.mockResolvedValue({
      data: {
        valueRanges: [
          { values: [[ID]] },
          { values: [[JSON.stringify({ [ME]: "ev1" })]] }, // 시트: 담김
        ],
      },
    });
    readGcalMapsFromDbBatch.mockResolvedValue(new Map([[ID, { [ME]: EXCLUDE_MARKER }]]));
    const states = await readGcalStates(SID, "meeting", [ID], ME);
    expect(states[ID]).toBe(false); // DB 의 제외 마커가 이김
  });

  it("시트 행을 못 찾아도 DB 마커가 있으면 반영된다", async () => {
    valuesBatchGet.mockResolvedValue({ data: { valueRanges: [{ values: [] }, { values: [] }] } });
    readGcalMapsFromDbBatch.mockResolvedValue(new Map([[ID, { [ME]: EXCLUDE_MARKER }]]));
    const states = await readGcalStates(SID, "meeting", [ID], ME);
    expect(states[ID]).toBe(false);
  });

  it("아무 데도 없으면 기본 ON", async () => {
    valuesBatchGet.mockResolvedValue({ data: { valueRanges: [{ values: [] }, { values: [] }] } });
    readGcalMapsFromDbBatch.mockResolvedValue(new Map());
    const states = await readGcalStates(SID, "meeting", [ID], ME);
    expect(states[ID]).toBe(true);
  });
});
