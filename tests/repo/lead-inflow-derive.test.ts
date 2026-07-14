/**
 * ADR-0029 — 콜·지·기·소 유입(F) = 생산(E) = 03 접수 건수 파생. repo 계약 고정:
 *  ① writeProductionCell(콜지기소) → 01 E:F 를 같은 값으로 1회 기입 + 미러 payload 에 inflow
 *  ② writeProductionCell(그 외 채널) → E 단일셀·미러에 inflow 없음(무변경)
 *  ③ batchWriteChannelDailyRows(콜지기소) → G:H 만(F 미기록 — 스테일 draft 가 파생값 덮는 것 차단)
 *  ④ 그 외 채널 range 무변경(매입DB=F:H · 직접생산/현수막=E:H)
 *
 * 좌표: 수강시작 2026-04-18(토) → 그 날 week1 day0. row = 10 + dayIdx*4 + channelIdx
 *       매입DB=10 · 직접생산=11 · 현수막=12 · 콜지기소=13
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelDailyRow } from "@/types";

type Arg = Record<string, unknown>;

const valuesGet = vi.fn(async (_p: Arg) => ({ data: { values: [["2026-04-18"]] } })); // O1 수강시작일
const valuesUpdate = vi.fn(async (_p: Arg) => ({}));
const valuesBatchUpdate = vi.fn(async (_p: Arg) => ({}));
const mirrorSheetRow = vi.fn((_p: Arg) => {});

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      values: { get: valuesGet, update: valuesUpdate, batchUpdate: valuesBatchUpdate },
    },
  }),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorSheetRow: (p: Arg) => mirrorSheetRow(p),
  mirrorClearRow: vi.fn(),
}));
vi.mock("@/repo/db/client", () => ({
  readSalesRowsFromDb: vi.fn(async () => []),
  dbEnabled: vi.fn(() => false),
  writeSalesRowsToDb: vi.fn(async () => {}),
}));

import { batchWriteChannelDailyRows } from "@/repo/sales";
import { writeProductionCell } from "@/repo/sales-production-cell";
import { toDbRows } from "@/service/sales-write";

const DATE = "2026-04-18";
const mkRow = (o: Partial<ChannelDailyRow>): ChannelDailyRow =>
  ({
    date: DATE, channel: "매입DB", production: 0, inflow: 0,
    contactProgress: 0, meetingReservation: 0, ...o,
  }) as ChannelDailyRow;

/** 마지막(첫) 호출의 첫 인자 — 타입 캐스팅 헬퍼. */
const firstArg = <T>(fn: { mock: { calls: Arg[][] } }): T =>
  fn.mock.calls[0]?.[0] as unknown as T;

beforeEach(() => {
  valuesGet.mockReset().mockResolvedValue({ data: { values: [["2026-04-18"]] } });
  valuesUpdate.mockReset().mockResolvedValue({});
  valuesBatchUpdate.mockReset().mockResolvedValue({});
  mirrorSheetRow.mockReset();
});

type UpdateArg = { range: string; requestBody: { values: number[][] } };
type MirrorArg = { rowKey: string; payload: Record<string, unknown> };
type BatchArg = { requestBody: { data: Array<{ range: string; values: unknown[][] }> } };

describe("writeProductionCell — 콜지기소는 E:F 동시(유입=생산)", () => {
  it("① 콜지기소 → E13:F13 에 [count, count] 1회 기입", async () => {
    await writeProductionCell("s1", DATE, "콜·지·기·소", 3);
    expect(valuesUpdate).toHaveBeenCalledTimes(1);
    const arg = firstArg<UpdateArg>(valuesUpdate);
    expect(arg.range).toContain("E13:F13");
    expect(arg.requestBody.values).toEqual([[3, 3]]);
  });

  it("① 미러 payload 에 production·inflow 둘 다(DB 정합)", async () => {
    await writeProductionCell("s1", DATE, "콜·지·기·소", 3);
    const m = firstArg<MirrorArg>(mirrorSheetRow);
    expect(m.rowKey).toBe(`${DATE}:콜·지·기·소`);
    expect(m.payload.production).toBe(3);
    expect(m.payload.inflow).toBe(3);
  });

  it("② 매입DB → E10 단일셀·미러에 inflow 없음(기존 동작 불변)", async () => {
    await writeProductionCell("s1", DATE, "매입DB", 5);
    const arg = firstArg<UpdateArg>(valuesUpdate);
    expect(arg.range).toContain("E10");
    expect(arg.range).not.toContain(":F");
    expect(arg.requestBody.values).toEqual([[5]]);
    const m = firstArg<MirrorArg>(mirrorSheetRow);
    expect(m.payload.production).toBe(5);
    expect(m.payload.inflow).toBeUndefined();
  });
});

describe("batchWriteChannelDailyRows — 콜지기소 F 미기록", () => {
  const data = () => firstArg<BatchArg>(valuesBatchUpdate).requestBody.data;

  it("③ 콜지기소 → G13:H13 만(유입 F 제외)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "콜·지·기·소", production: 2, inflow: 99, contactProgress: 4, meetingReservation: 1 }),
    ]);
    const d = data();
    expect(d).toHaveLength(1);
    expect(d[0]!.range).toContain("G13:H13");
    expect(d[0]!.range).not.toContain("F13");
    expect(d[0]!.values).toEqual([[4, 1]]); // 컨택진행·미팅예약만 — inflow 99 는 기록 안 됨
  });

  it("④ 매입DB → F10:H10 (유입 포함, 기존 동작 불변)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "매입DB", inflow: 7, contactProgress: 3, meetingReservation: 2 }),
    ]);
    expect(data()[0]!.range).toContain("F10:H10");
    expect(data()[0]!.values).toEqual([[7, 3, 2]]);
  });

  it("④ 현수막 → E12:H12 (게시=생산 포함, 무변경)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "현수막", production: 6, inflow: 5, contactProgress: 1, meetingReservation: 0 }),
    ]);
    expect(data()[0]!.range).toContain("E12:H12");
    expect(data()[0]!.values).toEqual([[6, 5, 1, 0]]);
  });

  it("④ 직접생산 → E11:H11 (E=유입 미러, 무변경)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "직접생산", production: 0, inflow: 8, contactProgress: 2, meetingReservation: 0 }),
    ]);
    expect(data()[0]!.range).toContain("E11:H11");
    expect(data()[0]!.values).toEqual([[8, 8, 2, 0]]);
  });
});

/** 리뷰 CONFIRMED 회귀: 스테일 draft 가 DB 파생값(생산·유입)을 0 으로 덮어 시트와 영구 불일치.
 *  → 컨택 저장 경로는 콜지기소의 두 키를 **DB 에도** 안 쓴다(jsonb 병합이 파생값 보존). */
describe("컨택 저장이 콜지기소 생산·유입을 DB 에 쓰지 않음(clobber 차단)", () => {
  it("⑤ toDbRows — 콜지기소 행에서 production·inflow 키 제거(다른 키는 보존)", () => {
    const [lead] = toDbRows([
      mkRow({ channel: "콜·지·기·소", production: 0, inflow: 0, contactProgress: 5, meetingReservation: 2 }),
    ]);
    expect(lead).toEqual({
      date: DATE, channel: "콜·지·기·소", contactProgress: 5, meetingReservation: 2,
    });
    expect("production" in lead!).toBe(false);
    expect("inflow" in lead!).toBe(false);
  });

  // R3⑤ PR-1 정정: 매입DB 의 production 도 03 집계 파생(ADR-0020)이라 컨택 저장은 DB 에 안 쓴다.
  // (이전 기대치 "4지표 그대로"는 선재 버그를 고정하고 있었음 — 클라 에코가 파생값을 덮음.)
  it("⑤ toDbRows — 매입DB 는 production 미기입·inflow 유지 / 현수막은 그대로", () => {
    const [pur] = toDbRows([
      mkRow({ channel: "매입DB", production: 3, inflow: 7, contactProgress: 1, meetingReservation: 0 }),
    ]);
    expect("production" in pur!).toBe(false);
    expect(pur).toMatchObject({ channel: "매입DB", inflow: 7 });
    const [ban] = toDbRows([mkRow({ channel: "현수막", production: 6, inflow: 5 })]);
    expect(ban).toMatchObject({ channel: "현수막", production: 6, inflow: 5 });
  });

  it("⑤ toDbRows — 직접생산은 production := inflow 매핑(시트 E=유입과 일치)", () => {
    const [dir] = toDbRows([mkRow({ channel: "직접생산", production: 0, inflow: 8 })]);
    expect(dir).toMatchObject({ channel: "직접생산", production: 8, inflow: 8 });
  });

  it("⑥ 시트정본 경로의 DB 미러도 콜지기소 생산·유입 제외", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "콜·지·기·소", production: 0, inflow: 0, contactProgress: 5, meetingReservation: 2 }),
    ]);
    const m = firstArg<MirrorArg>(mirrorSheetRow);
    expect(m.rowKey).toBe(`${DATE}:콜·지·기·소`);
    expect(m.payload.production).toBeUndefined();
    expect(m.payload.inflow).toBeUndefined();
    expect(m.payload.contactProgress).toBe(5);
  });

  // R3⑤ PR-1: 시트정본 경로의 DB 미러도 salesDbPayload 단일 규칙 — 시트에 쓴 것과 같은 값만.
  it("⑥ 시트정본 미러 — 매입DB 는 production 미기입(시트도 F:H 만 씀)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "매입DB", production: 3, inflow: 7, contactProgress: 1, meetingReservation: 0 }),
    ]);
    const m = firstArg<MirrorArg>(mirrorSheetRow);
    expect(m.payload.production).toBeUndefined();
    expect(m.payload.inflow).toBe(7);
  });

  it("⑥ 시트정본 미러 — 직접생산은 production := inflow(시트 E=유입과 일치)", async () => {
    await batchWriteChannelDailyRows("s1", [
      mkRow({ channel: "직접생산", production: 0, inflow: 8, contactProgress: 2, meetingReservation: 0 }),
    ]);
    const m = firstArg<MirrorArg>(mirrorSheetRow);
    expect(m.payload.production).toBe(8);
    expect(m.payload.inflow).toBe(8);
  });
});
