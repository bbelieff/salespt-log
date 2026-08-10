/**
 * BBE-66/63 최우선 지시(2026-08-10) — dashboard-parity.mjs 순수 로직(computeAggregates·diff·
 * buildAlternates·classifyDiff 연동) 검증. 합성 데이터로 실제 관측된 3개 원인 패턴을 재현한다.
 */
import { describe, expect, it } from "vitest";
import {
  buildAlternates,
  computeAggregates,
  contractFingerprint,
  diff,
  diffContractFingerprints,
  diffSourceFingerprints,
  normalizeSheetSalesGrid,
  inSheetWindow,
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
    expect(r.type).toBe("시차(DB 누락 후보)");
    expect(r.detail).toContain("DB 에 없는 행");
  });

  it("H.주X활동(sales 혼합 필드)은 isMeetingOrContractField 가 false — 시차 판정에서 제외된다", () => {
    expect(isMeetingOrContractField("H.주1활동")).toBe(false);
    expect(isMeetingOrContractField("R1:U6.매입DB.생산")).toBe(false);
  });

  it("반대 방향(sheet<db) — B21 550,000원 패턴 재현: 시차(DB extra·중복 후보)로 분류하고 'DB 에 없는 행'이라 단정하지 않는다", () => {
    // BBE-66 재분류(G작업원A, 2026-08-10): DB 가 sheet 보다 큰데 방향과 무관하게 "DB 에 없는 행"
    // 이라고 출력하면 산술적으로 불가능한 설명이 된다(DB 누락으로는 DB 합계가 더 커질 수 없음).
    const field = "B21.누적수임비";
    const r = classifyDiff(
      { field, sheetValue: 6600000, dbValue: 7150000 },
      { sheetRowRecount: 6600000 }, // 시트 원본 재계산 = 시트 수식값과 일치, DB 재계산과는 다름
    );
    expect(r.type).toBe("시차(DB extra·중복 후보)");
    expect(r.direction).toBe("sheet<db");
    expect(r.detail).not.toContain("DB 에 없는 행");
    expect(r.detail).toContain("정본");
  });
});

describe("주차 창 클램프 (BBE-66 재분류, G작업원A 진단 — #782 가 정본 inSheetWindow 를 누락)", () => {
  const CS = new Date(2026, 6, 3); // 2026-07-03

  it("inSheetWindow — 1~10주 안만 true, 시작 전(음수)·11주+ 는 false", () => {
    expect(inSheetWindow("2026-07-05", CS)).toBe(true); // 주1
    expect(inSheetWindow("2026-06-01", CS)).toBe(false); // 시작 전(week=0)
    expect(inSheetWindow("2026-12-01", CS)).toBe(false); // 11주+
    expect(inSheetWindow(undefined, CS)).toBe(false); // 날짜 없음 — fail-closed
  });

  it("sales 생산/유입/컨택진행은 창 밖이면 카운트에서 제외된다 — 정본 dashboard-aggregates.ts:97 동치", () => {
    const sales = [
      { channel: "매입DB", date: "2026-07-05", production: 5, inflow: 3, contactProgress: 2 }, // 주1 — 창 안
      { channel: "매입DB", date: "2026-12-01", production: 100, inflow: 100, contactProgress: 100 }, // 창 밖(11주+)
      { channel: "매입DB", date: "2026-06-01", production: 100, inflow: 100, contactProgress: 100 }, // 창 밖(시작 전)
    ];
    const agg = computeAggregates([], sales, [], CS, "2026-07-03");
    const m = agg.channelMatrix.find((c) => c.채널 === "매입DB")!;
    // 수정 전엔 205/203/202 로 부풀었다(#782 실측 — 채널별 계약: sheet<db 31/2, sales: sheet<db 4/1).
    expect(m.생산).toBe(5);
    expect(m.유입).toBe(3);
    expect(m.컨택진행).toBe(2);
  });

  it("R1:U6.계약(채널 계약수)도 미팅날짜가 창 밖이면 계약여부=true 라도 제외된다 — 정본 N 주차블록합 동치", () => {
    const meetings = [
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-05", 구분: "" }, // 주1 — 창 안
      { channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-12-01", 구분: "" }, // 창 밖
    ];
    const agg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    const m = agg.channelMatrix.find((c) => c.채널 === "매입DB")!;
    expect(m.계약).toBe(1); // 창 밖 1건은 제외
    expect(m.미팅예약).toBe(2); // R4/R5 는 COUNTIFS 무필터 — 창 클램프 금지(정본 실측)
    expect(m.미팅완료).toBe(2);
    // 창 밖 미팅도 후보 풀엔 남아있어야 한다 — 분류기 대안식이 재검토할 수 있게.
    expect(agg.contrib.get("R1:U6.매입DB.계약")).toHaveLength(2);
  });

  it("N 주차계약·H 주차활동은 이미 정본과 동일한 1~8주 클램프를 쓰고 있었다(회귀 없음 확인)", () => {
    const meetings = [{ channel: "매입DB", 상태: "계약", 계약여부: true, 미팅날짜: "2026-07-05", 구분: "" }];
    const agg = computeAggregates(meetings, [], [], CS, "2026-07-03");
    expect(agg.weeklyContracts[0]).toBe(1);
    expect(agg.weeklyContracts.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("diffContractFingerprints — B21 계약 지문 차집합 (PII 없음)", () => {
  it("sheet 에만 있는 계약(DB 누락 후보)을 잡는다", () => {
    const sheetRows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "" }];
    const dbRows: typeof sheetRows = [];
    const r = diffContractFingerprints(sheetRows, dbRows);
    expect(r.onlyInSheet).toEqual([{ 계약일: "2026-07-10", 수임비: 550000, 구분: "일반", sheetCount: 1, dbCount: 0 }]);
    expect(r.onlyInDb).toHaveLength(0);
  });

  it("DB 에만 있는 계약(DB extra·중복 후보)을 잡는다 — B21 550,000 패턴", () => {
    const sheetRows: { 계약일: string; 수임비: number; 구분: string }[] = [];
    const dbRows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "" }];
    const r = diffContractFingerprints(sheetRows, dbRows);
    expect(r.onlyInDb).toEqual([{ 계약일: "2026-07-10", 수임비: 550000, 구분: "일반", sheetCount: 0, dbCount: 1 }]);
    expect(r.onlyInSheet).toHaveLength(0);
  });

  it("같은 지문이 양쪽에 같은 건수로 있으면 차집합에 안 잡힌다", () => {
    const rows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "" }];
    const r = diffContractFingerprints(rows, rows.map((r) => ({ ...r })));
    expect(r.onlyInSheet).toHaveLength(0);
    expect(r.onlyInDb).toHaveLength(0);
    expect(r.countMismatch).toHaveLength(0);
  });

  it("같은 계약일·수임비인데 구분(이월 여부)만 다르면 '구분 드리프트' 후보로 별도 보고한다", () => {
    const sheetRows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "" }]; // 일반(집계 포함)
    const dbRows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "이월" }]; // 이월(집계 제외)
    const r = diffContractFingerprints(sheetRows, dbRows);
    expect(r.onlyInSheet).toHaveLength(1); // 지문(구분 포함) 기준으론 여전히 양쪽 다 unique
    expect(r.onlyInDb).toHaveLength(1);
    expect(r.typeDrift).toHaveLength(1);
    expect(r.typeDrift[0]!.detail).toContain("이월 판정 드리프트");
  });

  it("중복(같은 지문 2건 vs 1건)은 countMismatch 로 잡는다", () => {
    const sheetRows = [
      { 계약일: "2026-07-10", 수임비: 550000, 구분: "" },
      { 계약일: "2026-07-10", 수임비: 550000, 구분: "" },
    ];
    const dbRows = [{ 계약일: "2026-07-10", 수임비: 550000, 구분: "" }];
    const r = diffContractFingerprints(sheetRows, dbRows);
    expect(r.countMismatch).toEqual([{ 계약일: "2026-07-10", 수임비: 550000, 구분: "일반", sheetCount: 2, dbCount: 1 }]);
  });

  it("지문에 이름·이메일·회사명 등 PII 필드가 없다 — 계약일·수임비·구분만", () => {
    const c = { 계약일: "2026-07-10", 수임비: 550000, 구분: "", 이름: "김덕호", 이메일: "x@y.com" };
    expect(contractFingerprint(c)).toBe("2026-07-10|550000|일반");
  });
});

describe("diff() — sheet vs db 비교", () => {
  it("값이 같은 필드는 diff 에 안 잡힌다", () => {
    const sheet = { channelMatrix: [{ 채널: "매입DB", 생산: 1, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: 0 }], weeklyContracts: new Array(8).fill(0), weeklyActivity: new Array(8).fill(0), 누적수임비: 0 };
    const db = structuredClone(sheet);
    expect(diff(sheet, db)).toHaveLength(0);
  });
});

describe("잔여 diff 원행 진단", () => {
  it("01 E10:H349 좌표를 날짜·채널 sales 행으로 정규화한다", () => {
    const rows: unknown[][] = [
      [1, 2, 3, 4], // day 0 매입DB
      [5, 6, 7, 8], // day 0 직접생산
      [], [],
      [9, 10, 11, 12], // day 1 매입DB
    ];
    const out = normalizeSheetSalesGrid(rows, "2026-07-03");
    expect(out).toEqual([
      { date: "2026-07-03", channel: "매입DB", production: 1, inflow: 2, contactProgress: 3, meetingReservation: 4 },
      { date: "2026-07-03", channel: "직접생산", production: 5, inflow: 6, contactProgress: 7, meetingReservation: 8 },
      { date: "2026-07-04", channel: "매입DB", production: 9, inflow: 10, contactProgress: 11, meetingReservation: 12 },
    ]);
  });

  it("sales 지문 차집합은 날짜·채널·집계수치만 쓰고 누락/extra/중복을 나눈다", () => {
    const sheet = [{ date: "2026-07-03", channel: "직접생산", production: 38, inflow: 0, contactProgress: 0 }];
    const db: typeof sheet = [];
    const r = diffSourceFingerprints("sales", sheet, db);
    expect(r.onlyInSheet).toHaveLength(1);
    expect(r.onlyInSheet[0]!.fingerprint).toBe("date=2026-07-03|channel=직접생산|production=38|inflow=0|contactProgress=0");
    expect(r.onlyInDb).toHaveLength(0);
  });

  it("meeting 지문 차집합은 계약 동반 누락을 상태·계약여부·구분으로 식별한다", () => {
    const sheet = [{ 미팅날짜: "2026-07-03", channel: "매입DB", 상태: "계약", 계약여부: true, 구분: "" }];
    const r = diffSourceFingerprints("meetings", sheet, []);
    expect(r.onlyInSheet).toHaveLength(1);
    expect(r.onlyInSheet[0]!.fingerprint).toContain("상태=계약");
  });
});
