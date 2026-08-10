/**
 * BBE-66/63 최우선 지시(2026-08-10) — parity diff 원인 자동분류 순수 로직 검증.
 * DB·시트 연결 없이 scripts/ops/parity-classify.mjs 의 판정만 확인
 * (dashboard-parity.mjs 등과 같은 패턴 — tests/ops/backfill-db-row-numbers.test.ts 선례).
 */
import { describe, expect, it } from "vitest";
import {
  classifyDiff,
  looksLikeUnrenderedSerial,
  serialToISO,
  summarizeClassification,
} from "../../scripts/ops/parity-classify.mjs";

describe("looksLikeUnrenderedSerial", () => {
  it("ISO 날짜 문자열은 아니다", () => {
    expect(looksLikeUnrenderedSerial("2026-08-07")).toBe(false);
  });
  it("실사용 범위 숫자 문자열은 serial 로 본다(#752 실측 패턴)", () => {
    expect(looksLikeUnrenderedSerial("46241")).toBe(true); // 2026-08-07 의 실제 serial
  });
  it("범위 밖 숫자·비문자열·빈값은 아니다", () => {
    expect(looksLikeUnrenderedSerial(10)).toBe(false); // 숫자 자체가 아니라 값의 타입이 string 이 아님
    expect(looksLikeUnrenderedSerial("10")).toBe(false); // 범위 밖(20000 미만)
    expect(looksLikeUnrenderedSerial("")).toBe(false);
    expect(looksLikeUnrenderedSerial(undefined)).toBe(false);
  });
});

describe("serialToISO", () => {
  it("Sheets serial(epoch 1899-12-30)을 ISO 로 변환한다", () => {
    expect(serialToISO("46241")).toBe("2026-08-07");
  });
});

describe("classifyDiff", () => {
  const base = { field: "R1:U6.매입DB.계약", sheetValue: 3, dbValue: 0 };

  it("① 렌더옵션 — 기여 행에 미변환 serial 날짜가 있으면 최우선으로 잡는다", () => {
    const r = classifyDiff(base, {
      contributingDbRows: [{ 미팅날짜: "46241", 상태: "계약" }],
      alternates: [{ name: "무시됨(렌더옵션이 먼저)", recompute: () => 3 }], // ①이 ②보다 먼저 걸림을 검증
    });
    expect(r.type).toBe("렌더옵션");
    expect(r.detail).toContain("미팅날짜");
    expect(r.detail).toContain("2026-08-07");
  });

  it("② 로직차이 — 대안 계산식이 sheet 값과 일치하면 그 식을 근인으로 지목한다", () => {
    const rows = [
      { 상태: "완료", 계약여부: true }, // 상태 기준이면 미포함, 계약여부 기준이면 포함
      { 상태: "계약", 계약여부: true },
      { 상태: "계약", 계약여부: true },
    ];
    const r = classifyDiff(base, {
      contributingDbRows: rows,
      alternates: [
        {
          name: "계약여부 기준(상태 대신)",
          recompute: (rs) => rs.filter((x) => x.계약여부).length, // = 3 = sheetValue
        },
      ],
    });
    expect(r.type).toBe("로직차이");
    expect(r.detail).toContain("계약여부 기준");
  });

  it("대안식이 sheet 값과 안 맞으면 로직차이로 판정하지 않는다(오탐 방지)", () => {
    const r = classifyDiff(base, {
      contributingDbRows: [{}],
      alternates: [{ name: "안 맞는 대안", recompute: () => 999 }],
    });
    expect(r.type).not.toBe("로직차이");
  });

  it("③ 시차 — 시트 row 재계산이 수식값과 일치·DB 재계산과는 다르면 '행이 DB 에 없음'으로 판정", () => {
    const r = classifyDiff(base, { sheetRowRecount: 3 }); // sheetValue=3 과 일치, dbValue=0 과는 다름
    expect(r.type).toBe("시차");
    expect(r.detail).toContain("DB 에 없는 행");
  });

  it("시트 row 재계산이 sheet 수식값과도 다르면 시차로 판정하지 않는다(수식 자체가 이상한 케이스는 진짜불일치로 남김)", () => {
    const r = classifyDiff(base, { sheetRowRecount: 5 }); // sheetValue=3 과도 다름
    expect(r.type).not.toBe("시차");
  });

  it("④ 진짜불일치 — 위 어디에도 안 걸리면 기본값", () => {
    const r = classifyDiff(base, {});
    expect(r.type).toBe("진짜불일치");
  });

  it("판정 우선순위 — 렌더옵션이 로직차이·시차보다 항상 먼저 걸린다", () => {
    const r = classifyDiff(base, {
      contributingDbRows: [{ 계약일: "46241" }],
      alternates: [{ name: "이것도 맞음", recompute: () => 3 }],
      sheetRowRecount: 3,
    });
    expect(r.type).toBe("렌더옵션");
  });

  it("판정 우선순위 — 로직차이가 시차보다 먼저 걸린다(렌더옵션 없을 때)", () => {
    const r = classifyDiff(base, {
      contributingDbRows: [{}],
      alternates: [{ name: "일치", recompute: () => 3 }],
      sheetRowRecount: 3,
    });
    expect(r.type).toBe("로직차이");
  });

  it("실제 BBE-53 감사에서 관측된 계약여부 드리프트 패턴을 재현한다", () => {
    // 실측(BBE-64 조사, 2026-08-09): channelMatrixFromDb 의 계약 카운트가 상태 대신
    // 계약여부(파생·동기화용 필드)를 써서 sheet=0, db>0 로 벌어지는 실제 사례.
    const d = { field: "R1:U6.매입DB.계약", sheetValue: 0, dbValue: 13 };
    const rows = [
      { 상태: "완료", 계약여부: true }, // 상태는 완료인데 계약여부는 stale 하게 true 로 남음
    ];
    const r = classifyDiff(d, {
      contributingDbRows: rows,
      alternates: [
        { name: "상태=계약 기준(계약여부 대신)", recompute: (rs) => rs.filter((x) => x.상태 === "계약").length },
      ],
    });
    expect(r.type).toBe("로직차이");
  });
});

describe("summarizeClassification", () => {
  const items = [
    { user: "a@x.com", field: "f1", sheetValue: 1, dbValue: 0, type: "시차", detail: "d1" },
    { user: "b@x.com", field: "f2", sheetValue: 1, dbValue: 0, type: "시차", detail: "d2" },
    { user: "c@x.com", field: "f3", sheetValue: 1, dbValue: 0, type: "시차", detail: "d3" },
    { user: "d@x.com", field: "f4", sheetValue: 1, dbValue: 0, type: "시차", detail: "d4" }, // 4번째 — 샘플 3건 초과분
    { user: "e@x.com", field: "f5", sheetValue: 2, dbValue: 5, type: "렌더옵션", detail: "d5" },
    { user: "f@x.com", field: "f6", sheetValue: 3, dbValue: 9, type: "진짜불일치", detail: "d6" },
  ];

  it("유형별 건수를 정확히 센다", () => {
    const { counts } = summarizeClassification(items);
    expect(counts["시차"]).toBe(4);
    expect(counts["렌더옵션"]).toBe(1);
    expect(counts["로직차이"]).toBe(0);
    expect(counts["진짜불일치"]).toBe(1);
  });

  it("'진짜 불일치'만 별도 목록으로 뽑는다 — 다른 유형은 안 섞임", () => {
    const { real } = summarizeClassification(items);
    expect(real).toHaveLength(1);
    expect(real[0]!.user).toBe("f@x.com");
  });

  it("출력 텍스트에 유형별 샘플이 최대 3건까지만 보이고 초과분은 건수로 요약된다", () => {
    const { text } = summarizeClassification(items);
    expect(text).toContain("[시차] 4건");
    expect(text).toContain("… 외 1건");
    expect(text).toContain("a@x.com"); // 샘플 1
    expect(text).toContain("c@x.com"); // 샘플 3
    expect(text).not.toContain("d@x.com f4"); // 4번째는 샘플 목록엔 없음
  });

  it("'진짜 불일치' 0건이면 안내 문구를 남긴다", () => {
    const { text } = summarizeClassification(items.filter((i) => i.type !== "진짜불일치"));
    expect(text).toContain("없음 — 전부 알려진 원인으로 설명됨");
  });
});
