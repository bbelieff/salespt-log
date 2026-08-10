/**
 * BBE-66/63 최우선 지시(2026-08-10) — dashboard-parity.mjs 순수 로직(computeAggregates·diff·
 * buildAlternates·classifyDiff 연동) 검증. 합성 데이터로 실제 관측된 3개 원인 패턴을 재현한다.
 */
import { describe, expect, it } from "vitest";
import {
  buildAlternates,
  computeAggregates,
  diff,
  isMeetingOrContractField,
  lookupField,
} from "../../scripts/ops/dashboard-parity-lib.mjs";
import { classifyDiff } from "../../scripts/ops/parity-classify.mjs";

const CS = new Date(2026, 6, 3); // 2026-07-03 (금) — 테스트용 course start

describe("computeAggregates — 기본 집계", () => {
  it("sales/meetings/contracts 를 채널·주차별로 정확히 집계한다", () => {
    const meetings = [
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-04", 구분: "" }, // course start +1일 = 주1
      { channel: "매입DB", 상태: "예약", 계약여부: false, 미팅날짜: "2026-07-05", 구분: "" },
    ];
    const sales = [{ channel: "매입DB", date: "2026-07-05", production: 5, inflow: 3, contactProgress: 2 }];
    const agg = computeAggregates(meetings, sales, [], CS, "2026-07-03");
    const m = agg.channelMatrix.find((c) => c.채널 === "매입DB")!;
    expect(m.계약).toBe(1);
    expect(m.미팅예약).toBe(2); // 예약+계약 둘 다 "살아있는" 미팅
    expect(m.생산).toBe(5);
    expect(agg.weeklyContracts[0]).toBe(1); // 주1(course start 포함 주)
  });

  it("이월(구분=이월) 미팅은 channelMatrix 에서 제외된다", () => {
    const meetings = [{ channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-10", 구분: "이월" }];
    const agg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    const m = agg.channelMatrix.find((c) => c.채널 === "매입DB")!;
    expect(m.계약).toBe(0);
  });

  it("contrib 후보 풀은 실제 카운트 조건과 무관하게 채널의 이월 아닌 미팅 전부를 담는다", () => {
    // 상태=완료·계약여부=false 인 행 — 계약 카운트엔 안 들어가지만, "상태=계약 기준" 대안식이
    // 검토할 수 있으려면 이 행도 후보 풀(R1:U6.매입DB.계약)에 있어야 한다.
    const meetings = [{ channel: "매입DB", 상태: "완료", 계약여부: false, 미팅날짜: "2026-07-10", 구분: "" }];
    const agg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    expect(agg.contrib.get("R1:U6.매입DB.계약")).toHaveLength(1);
  });
});

describe("실제 관측 패턴 재현 — ① 로직차이(계약여부 드리프트, BBE-64)", () => {
  it("sheet=0, db>0 인데 원인이 계약여부 필드 드리프트면 '로직차이' 로 분류된다", () => {
    // 상태는 완료로 바뀌었는데 계약여부(파생 필드)가 stale 하게 true 로 남아있는 실제 관측 사례.
    const meetings = [
      { channel: "매입DB", 상태: "완료", 계약여부: true, 미팅날짜: "2026-07-10", 구분: "" },
    ];
    const dbAgg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    const field = "R1:U6.매입DB.계약";
    // 시트(정본=상태 기준)는 0 — 아래 sheetValue 로 직접 반영. dbValue 는 현재(계약여부 기준) 로직 결과 = 1.
    const sheetValue = 0, dbValue = dbAgg.channelMatrix.find((c) => c.채널 === "매입DB")!.계약;
    expect(dbValue).toBe(1);
    const r = classifyDiff(
      { field, sheetValue, dbValue },
      { contributingDbRows: dbAgg.contrib.get(field), alternates: buildAlternates(field) },
    );
    expect(r.type).toBe("로직차이");
    expect(r.detail).toContain("상태=계약 기준");
  });
});

describe("실제 관측 패턴 재현 — ② 렌더옵션(#752 패턴)", () => {
  it("DB row 의 날짜 필드가 미변환 serial 이면 '렌더옵션' 으로 분류된다(다른 원인보다 우선)", () => {
    const meetings = [
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-10", 구분: "", _raw미팅날짜: "46213" }, // 미변환 serial 흔적
    ];
    const dbAgg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    const field = "R1:U6.매입DB.계약";
    const r = classifyDiff(
      { field, sheetValue: 0, dbValue: 1 },
      { contributingDbRows: dbAgg.contrib.get(field), alternates: buildAlternates(field) },
    );
    expect(r.type).toBe("렌더옵션");
  });
});

describe("실제 관측 패턴 재현 — ③ 시차(BBE-63 인시던트 — db=0, sheet>0, 미팅+계약 동반)", () => {
  it("시트 원본 행 재계산이 시트 수식값과 일치하고 DB 는 그 행 자체가 없으면 '시차' 로 분류된다", () => {
    // incident: sheet 는 미팅 3건(계약)을 갖고 있는데 sheet_rows(DB)에는 그 행들이 아예 없음.
    const field = "N.주1계약";
    const dbAgg = computeAggregates([], [], [], CS, "2026-07-03"); // DB 에 미팅 자체가 없음
    const sheetMeetings = [
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-06", 구분: "" },
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-07", 구분: "" },
      { channel: "직접생산", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-08", 구분: "" },
    ];
    const sheetRowAgg = computeAggregates(sheetMeetings, [], [], CS, "2026-07-03");
    const sheetRowRecount = lookupField(sheetRowAgg, field); // = 3
    expect(sheetRowRecount).toBe(3);
    expect(isMeetingOrContractField(field)).toBe(true);

    const r = classifyDiff(
      { field, sheetValue: 3, dbValue: 0 },
      { contributingDbRows: dbAgg.contrib.get(field) ?? [], alternates: buildAlternates(field), sheetRowRecount },
    );
    expect(r.type).toBe("시차");
    expect(r.detail).toContain("DB 에 없는 행");
  });

  it("H.주X활동(sales 혼합 필드)은 isMeetingOrContractField 가 false — 시차 판정에서 제외된다", () => {
    expect(isMeetingOrContractField("H.주1활동")).toBe(false);
    expect(isMeetingOrContractField("R1:U6.매입DB.생산")).toBe(false);
  });
});

describe("diff() — sheet vs db 비교", () => {
  it("값이 같은 필드는 diff 에 안 잡힌다", () => {
    const sheet = { channelMatrix: [{ 채널: "매입DB", 생산: 1, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: 0 }], weeklyContracts: new Array(8).fill(0), weeklyActivity: new Array(8).fill(0), 누적수임비: 0 };
    const db = structuredClone(sheet);
    expect(diff(sheet, db)).toHaveLength(0);
  });
});
