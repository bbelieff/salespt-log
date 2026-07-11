/**
 * 단위 테스트: gcal-event-ids 읽기 경로의 "exceeds grid limits" 내성.
 *
 * 2026-07-12 카나리아 실측: 04 업체관리가 45열(A~AS)인 시트는 gcal_event_ids
 * 컬럼(AT=46열)이 grid 밖 → 읽기가 400 "Range exceeds grid limits. Max columns: 45"
 * 로 터져 upsert(무음 실패)·resyncAll(500)·토글 초기상태가 전부 죽음.
 * 컬럼 없음 = 매핑·마커 없음이므로 읽기는 빈 맵/기본 ON 으로 처리해야 한다
 * (그리드 확장은 쓰기 경로 setGcalEventId 의 ensureGridColumns 만 수행).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { values } = vi.hoisted(() => ({
  values: {
    get: vi.fn<(p: { range: string }) => Promise<unknown>>(),
    batchGet: vi.fn<(p: { ranges: string[] }) => Promise<unknown>>(),
    update: vi.fn<() => Promise<unknown>>(),
  },
}));

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({ spreadsheets: { values } }),
  ensureGridColumns: vi.fn(async () => {}),
}));

import { readGcalMap, readGcalStates } from "@/repo/gcal-event-ids";

/** 실제 Sheets API(GaxiosError)가 던지는 모양의 grid limits 400. */
function gridLimitsError(): Error & { code: number; status: number } {
  return Object.assign(
    new Error(
      "Unable to parse range: Range ('04 업체관리(예약제도)'!AT2:AT) exceeds grid limits. Max rows: 1000, max columns: 45",
    ),
    { code: 400, status: 400 },
  );
}

const SID = "sheet-45cols";

beforeEach(() => {
  values.get.mockReset();
  values.batchGet.mockReset();
  values.update.mockReset();
});

describe("readGcalMap — 45열 시트(AT 미생성) 내성", () => {
  it("맵 셀 읽기가 grid limits 400 이면 throw 없이 빈 맵", async () => {
    values.get.mockImplementation(async ({ range }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m1"], ["m2"]] } };
      throw gridLimitsError(); // AT 셀 읽기
    });
    await expect(readGcalMap(SID, "meeting", "m2")).resolves.toEqual({});
  });

  it("grid limits 가 아닌 에러(429 등)는 그대로 전파", async () => {
    values.get.mockImplementation(async ({ range }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m1"]] } };
      throw Object.assign(new Error("Quota exceeded"), { code: 429 });
    });
    await expect(readGcalMap(SID, "meeting", "m1")).rejects.toThrow("Quota exceeded");
  });

  it("400 이어도 grid limits 메시지가 아니면 전파 (보수적 가드)", async () => {
    values.get.mockImplementation(async ({ range }) => {
      if (range.endsWith("!A2:A")) return { data: { values: [["m1"]] } };
      throw Object.assign(new Error("Invalid value at 'data'"), { code: 400 });
    });
    await expect(readGcalMap(SID, "meeting", "m1")).rejects.toThrow("Invalid value");
  });
});

describe("readGcalStates — 45열 시트(AT 미생성) 내성", () => {
  it("batchGet 이 grid limits 400 이면 전원 기본 ON", async () => {
    values.batchGet.mockRejectedValue(gridLimitsError());
    await expect(readGcalStates(SID, "meeting", ["m1", "m2"], "a@b.c")).resolves.toEqual({
      m1: true,
      m2: true,
    });
  });

  it("grid limits 가 아닌 에러는 그대로 전파", async () => {
    values.batchGet.mockRejectedValue(Object.assign(new Error("boom"), { code: 500 }));
    await expect(readGcalStates(SID, "meeting", ["m1"], "a@b.c")).rejects.toThrow("boom");
  });

  it("정상 시트(컬럼 존재)는 기존 동작 그대로 — 마커 '-' 는 OFF", async () => {
    values.batchGet.mockResolvedValue({
      data: {
        valueRanges: [
          { values: [["m1"], ["m2"]] },
          { values: [[`{"a@b.c":"-"}`], [`{"a@b.c":"ev123"}`]] },
        ],
      },
    });
    await expect(readGcalStates(SID, "meeting", ["m1", "m2"], "a@b.c")).resolves.toEqual({
      m1: false,
      m2: true,
    });
  });
});
