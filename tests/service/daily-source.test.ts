/**
 * R2-1 db-read-contact — 게이트 + 시트/DB 경로 정합 대조 (수용 기준 고정).
 *  1) 파일럿 기수(8·9·연습)만 DB, 그 외는 시트 경로 (게이트 단일 지점).
 *  2) 같은 원천 데이터 → 시트형 rows 와 DB형 rows 가 4채널×4지표 완전 동일.
 */
import { describe, expect, it } from "vitest";
import {
  chooseDailySource,
  dayChannelsFromRows,
  isDbReadPilot,
  stackingSumsFromRows,
  type DailyMetricRow,
} from "@/service/daily-source";
import { CHANNEL_ORDER } from "@/types";

describe("isDbReadPilot / chooseDailySource (파일럿 게이트)", () => {
  it("8·9·연습(기 접미 허용) + 아레나(A시즌-기수, R2-1.5) 파일럿", () => {
    for (const c of ["8", "9", "연습", "8기", "9기"]) expect(isDbReadPilot(c)).toBe(true);
    // R2-1.5(db-pilot-arena): 아레나 라벨 편입 — 현재 라벨(A1-N) 그대로 판정.
    for (const c of ["A1-0", "A1-3", "A1-6", "A1-6기", "A2-1"]) expect(isDbReadPilot(c)).toBe(true);
    for (const c of ["7", "7기", "T", "관리", "A기", "", null, undefined])
      expect(isDbReadPilot(c as string | null | undefined)).toBe(false);
  });
  it("비대상 기수(7기 등)는 DB 켜져 있어도 시트 경로 고정 (수용 기준 — 불변)", () => {
    expect(chooseDailySource("7", true)).toBe("sheet");
    expect(chooseDailySource("6", true)).toBe("sheet");
  });
  it("아레나는 DB 켜져 있으면 db, 꺼져 있으면 시트 (R2-1.5)", () => {
    expect(chooseDailySource("A1-6", true)).toBe("db");
    expect(chooseDailySource("A1-6", false)).toBe("sheet");
  });
  it("파일럿 기수라도 DATABASE_URL 없으면 시트", () => {
    expect(chooseDailySource("9", false)).toBe("sheet");
    expect(chooseDailySource("9", true)).toBe("db");
  });
});

describe("시트 경로 vs DB 경로 정합 (4채널×4지표)", () => {
  // 원천: 파일럿 사용자 1명의 이틀치 기록 시나리오.
  const D1 = "2026-07-10";
  const D2 = "2026-07-11";
  // 시트 경로 rows = readWeek 산출 형태 (전부 number).
  const sheetRows: DailyMetricRow[] = [
    { date: D1, channel: "매입DB", production: 30, inflow: 5, contactProgress: 3, meetingReservation: 1 },
    { date: D1, channel: "직접생산", production: 4, inflow: 4, contactProgress: 2, meetingReservation: 0 },
    { date: D1, channel: "현수막", production: 6, inflow: 1, contactProgress: 1, meetingReservation: 1 },
    { date: D1, channel: "콜·지·기·소", production: 2, inflow: 2, contactProgress: 1, meetingReservation: 0 },
    { date: D2, channel: "매입DB", production: 20, inflow: 7, contactProgress: 4, meetingReservation: 2 },
    { date: D2, channel: "현수막", production: 3, inflow: 0, contactProgress: 0, meetingReservation: 0 },
  ];
  // DB 경로 rows = 같은 원천의 sheet_rows payload 정규화 산출 — repo 가 숫자로 정규화하므로
  // 형태 동일. (backfill 문자열 payload 정규화는 repo readSalesRowsFromDb 의 toNum 소관.)
  const dbRows: DailyMetricRow[] = [...sheetRows].reverse(); // 순서 무관 검증 겸

  it("dayChannelsFromRows — 두 경로 결과 완전 동일 (D1·D2 각각)", () => {
    for (const d of [D1, D2]) {
      expect(dayChannelsFromRows(dbRows, d)).toEqual(dayChannelsFromRows(sheetRows, d));
    }
  });

  it("D1 매입DB 지표 실값 검증 + 미기록 채널은 0", () => {
    const ch = dayChannelsFromRows(sheetRows, D2);
    expect(ch.매입DB).toEqual({ production: 20, inflow: 7, contactProgress: 4, meetingReservation: 2 });
    expect(ch.직접생산).toEqual({ production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 });
  });

  it("stackingSums — 시트 R1:U6 수식 의미(채널별 전 기간 합)와 동일, 두 경로 동일", () => {
    const a = stackingSumsFromRows(sheetRows);
    const b = stackingSumsFromRows(dbRows);
    expect(a).toEqual(b);
    expect(a).toEqual({ 매입DB생산합: 50, 매입DB유입합: 12, 현수막생산합: 9 });
  });

  it("알 수 없는 채널 문자열은 집계에서 무시(오염 payload 가드)", () => {
    const dirty = [
      ...sheetRows,
      { date: D1, channel: "콜지기소" as never, production: 99, inflow: 99, contactProgress: 99, meetingReservation: 99 },
    ];
    expect(dayChannelsFromRows(dirty, D1)).toEqual(dayChannelsFromRows(sheetRows, D1));
    expect(CHANNEL_ORDER).toHaveLength(4);
  });
});
