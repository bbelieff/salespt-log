/**
 * BBE-66/63 최우선 지시(2026-08-10) — scoreboard-parity.mjs 순수 로직 검증.
 * 2026-08-10 인시던트(docs/incidents/2026-08-10-scoreboard-db-parity-gap.md) 의 실제 관측
 * 패턴("db=0, sheet>0, 미팅+계약 항상 동반")을 합성 데이터로 재현해 시차 분류를 검증한다.
 */
import { describe, expect, it } from "vitest";
import {
  buildAlternates,
  computeWeeklyPerf,
  diffWeekly,
  isMeetingField,
  lookupWeekField,
} from "../../scripts/ops/scoreboard-parity-lib.mjs";
import { classifyDiff } from "../../scripts/ops/parity-classify.mjs";

const CS = new Date(2026, 6, 3); // 2026-07-03

describe("computeWeeklyPerf", () => {
  it("미팅완료(상태∈{완료,계약})·계약(상태=계약)을 주차별로 센다", () => {
    const meetings = [
      { 상태: "계약", 미팅날짜: "2026-07-04", 구분: "" },
      { 상태: "완료", 미팅날짜: "2026-07-05", 구분: "" },
      { 상태: "예약", 미팅날짜: "2026-07-05", 구분: "" }, // 예약은 미팅완료에 안 잡힘
    ];
    const { weeks } = computeWeeklyPerf(meetings, [], CS);
    expect(weeks[0]!.미팅).toBe(2); // 계약+완료
    expect(weeks[0]!.계약).toBe(1);
  });

  it("이월(구분=이월) 미팅은 실제 카운트에서 제외되지만 contrib 후보 풀엔 남는다(대안식용)", () => {
    const meetings = [{ 상태: "계약", 미팅날짜: "2026-07-04", 구분: "이월" }];
    const { weeks, contrib } = computeWeeklyPerf(meetings, [], CS);
    expect(weeks[0]!.계약).toBe(0);
    expect(contrib.get("주1.계약")).toHaveLength(1);
  });
});

describe("실제 인시던트 재현 — 시차(2026-08-10, db=0·sheet>0·미팅+계약 동반)", () => {
  it("시트엔 있는데 DB 에 그 미팅 행 자체가 없으면 '시차' 로 분류된다", () => {
    // 인시던트 실측 패턴 그대로: practice@salespt.local 주1.미팅 sheet=9/db=0, 주1.계약 sheet=3/db=0
    const dbAgg = computeWeeklyPerf([], [], CS); // DB 에 미팅 자체가 없음(0건)
    const sheetMeetings = [
      { 상태: "계약", 미팅날짜: "2026-07-04", 구분: "" },
      { 상태: "계약", 미팅날짜: "2026-07-05", 구분: "" },
      { 상태: "완료", 미팅날짜: "2026-07-05", 구분: "" },
    ];
    const sheetRowAgg = computeWeeklyPerf(sheetMeetings, [], CS);

    for (const field of ["주1.미팅", "주1.계약"]) {
      expect(isMeetingField(field)).toBe(true);
      const sheetValue = lookupWeekField(sheetRowAgg.weeks, field); // 미팅=3, 계약=2
      const r = classifyDiff(
        { field, sheetValue, dbValue: 0 },
        {
          contributingDbRows: dbAgg.contrib.get(field) ?? [],
          alternates: buildAlternates(field),
          sheetRowRecount: sheetValue,
        },
      );
      expect(r.type).toBe("시차(DB 누락 후보)"); // sheet(3·2) > db(0) — BBE-66(2026-08-10) 방향분리
    }
  });

  it("생산/유입/컨택(sales 파생)은 isMeetingField 가 false — 시차 판정 대상이 아니다", () => {
    expect(isMeetingField("주1.생산")).toBe(false);
    expect(isMeetingField("주1.유입")).toBe(false);
    expect(isMeetingField("주1.컨택")).toBe(false);
  });
});

describe("diffWeekly", () => {
  it("8주 × 5지표를 비교해 다른 것만 뽑는다", () => {
    const sheet = Array.from({ length: 8 }, (_, w) => ({ week: w + 1, 생산: 0, 유입: 0, 컨택: 0, 미팅: 0, 계약: 0 }));
    const db = structuredClone(sheet);
    db[2]!.계약 = 1; // 주3.계약만 다르게
    const ds = diffWeekly(sheet, db);
    expect(ds).toHaveLength(1);
    expect(ds[0]!.f).toBe("주3.계약");
  });
});
