/**
 * BBE-67 — scripts/ops/backfill-sheet-rows.mjs 의 5기 legacy 어댑터 순수 함수 단위 테스트.
 * 실데이터 아님(합성 fixture) — census(Linear BBE-67 코멘트)가 확인한 구조 패턴만 재현.
 * DB/Sheets 연결 없이 파싱 로직만 검증(isMainModule 가드로 main() 격리 — 이 import 자체가
 * CLI 인자검증/process.exit 을 트리거하지 않는다).
 */
import { describe, expect, it } from "vitest";
import {
  parseLegacyDbManagement,
  parseLegacySalesRows,
} from "../../scripts/ops/backfill-sheet-rows.mjs";

describe("parseLegacyDbManagement — 5기 DB관리 → 모던 03 DB관리 컬럼 재매핑", () => {
  // census 3표본 구조: 매입DB(A~F)+직접생산(G~L) 나란히 → 합계 → 현수막(A~G) → 합계
  // → 지인/기고객/소개(A~G) → 합계.
  const rows = [
    ["*DB유입 채널 증가시 양식 복사하여 추가"],
    ["DB관리"],
    ["매입DB", "", "", "", "", "", "직접생산(메타 등)"],
    ["구매일", "업체명", "개당단가", "주문개수", "주문금액", "기타", "날짜", "소재", "기간예산", "생산개수", "개당단가", "기타"],
    ["3/25", "테스트업체1", "31000", "30", "1023000", "부과세포함", "4/13", "당근", "100000", "3", "30000", "메타별도"],
    ["4/13", "테스트업체2", "100", "3", "960000", "부과세포함"],
    ["합계", "", "", "", "₩31,000", "130"],
    [],
    ["현수막"],
    ["날짜", "업체명", "도착일", "개당단가", "주문개수", "주문금액", "기타"],
    ["3/26", "테스트현수막1", "3/26", "5500", "100", "528000", "우천취소"],
    ["합계", "", "", "₩5,500", "100"],
    [],
    ["지인, 기고객, 소개"],
    ["구분", "접수일", "대표자명", "업체명", "소개처", "연락처", "조건"],
    ["지인", "5/1", "테스트대표", "테스트지인업체", "", "010-0000-0000", ""],
    ["기고객", "", "", "", "", "", ""],
    ["소개", "", "", "", "", "", ""],
    ["소개", "", "", "", "", "", ""],
    ["합계", "", "", "", "₩0", "0"],
  ];

  it("매입DB — 모던 컬럼 문자(B~G)로 재매핑, '주문금액'은 F(부가세여부) 자리로 새지 않고 버려진다", () => {
    const out = parseLegacyDbManagement(rows);
    const row1 = out.find((r) => r.rowKey === "매입DB:r5");
    expect(row1).toBeDefined();
    expect(row1!.payload).toEqual({
      _backfill: true,
      B: "3/25", // 구매일
      C: "테스트업체1", // 업체명
      D: "31000", // 개당단가
      E: "30", // 주문개수
      G: "부과세포함", // 기타
    });
    expect(row1!.payload).not.toHaveProperty("F"); // 주문금액(1023000)이 부가세여부 자리에 안 끼워짐
  });

  it("직접생산 — 같은 데이터 행에서 G열 이후 파싱, 개당단가(대응 없음)는 버리고 기타(O)는 보존", () => {
    const out = parseLegacyDbManagement(rows);
    const row1 = out.find((r) => r.rowKey === "직접생산:r5");
    expect(row1).toBeDefined();
    expect(row1!.payload).toEqual({
      _backfill: true,
      I: "4/13", // 시작일(legacy "날짜")
      K: "당근", // 소재 (J=종료일 공란이라 키 없음)
      L: "100000", // 기간예산
      M: "3", // 생산개수
      O: "메타별도", // 기타
    });
  });

  it("매입DB 두 번째 데이터 행(직접생산 값 없음) — 직접생산 행은 미생성", () => {
    const out = parseLegacyDbManagement(rows);
    expect(out.find((r) => r.rowKey === "매입DB:r6")).toBeDefined();
    expect(out.find((r) => r.rowKey === "직접생산:r6")).toBeUndefined();
  });

  it("합계 행에서 매입DB/직접생산 파싱 종료(합계를 데이터로 안 먹음)", () => {
    const out = parseLegacyDbManagement(rows);
    expect(out.filter((r) => r.rowKey.startsWith("매입DB:"))).toHaveLength(2);
    expect(out.filter((r) => r.rowKey.startsWith("직접생산:"))).toHaveLength(1);
  });

  it("현수막 — 독립 헤더 재탐색, 모던 P~V 로 매핑, '주문금액'은 U(부가세여부) 자리로 새지 않고 버려진다", () => {
    const out = parseLegacyDbManagement(rows);
    const banner = out.find((r) => r.rowKey.startsWith("현수막:"));
    expect(banner).toBeDefined();
    expect(banner!.payload).toEqual({
      _backfill: true,
      P: "3/26", // 날짜
      Q: "테스트현수막1", // 업체명
      R: "3/26", // 도착일
      S: "5500", // 개당단가
      T: "100", // 주문개수
      V: "우천취소", // 기타
    });
    expect(banner!.payload).not.toHaveProperty("U"); // 주문금액(528000) 안 새어들어감
  });

  it("지인/기고객/소개 — 분류 라벨(col0)만 있으면 나머지 공란이어도 유효 행으로 포함(빈 템플릿 잔재만 skip)", () => {
    const out = parseLegacyDbManagement(rows);
    const referrals = out.filter((r) => r.rowKey.startsWith("콜지기소:"));
    expect(referrals).toHaveLength(4); // 지인 1 + 기고객 1(공란) + 소개 2(공란) — 전부 라벨은 유효
    expect(referrals[0]!.payload).toEqual({
      _backfill: true,
      X: "지인",
      Y: "5/1",
      Z: "테스트대표",
      AA: "테스트지인업체",
      AC: "010-0000-0000",
    });
    expect(referrals[1]!.payload).toEqual({ _backfill: true, X: "기고객" });
  });

  it("헤더 자체가 없는 시트(빈 배열) → 빈 결과, 예외 없음", () => {
    expect(parseLegacyDbManagement([])).toEqual([]);
  });
});

describe("parseLegacySalesRows — 5기 영업관리 순차 스캔(고정좌표 없음)", () => {
  const YEAR = 2026;

  // census 확정: 요일,날짜,채널(0~2) 다음 서브헤더(실제 컬럼명, 3열부터),
  // 하루=4행(매입DB→직접생산→현수막→지-기-소, 항상 존재), 날짜는 매입DB 행에만.
  function weekBlock(metricHeaderVariant: string[], dayRows: string[][]) {
    return [
      ["1주차", "3/21", "~", "3/27"],
      ["요일", "날짜", "채널", "영업 (컨택관리)", "영업 (미팅관리)", "계약관리", "실적관리"],
      ["", "", "", ...metricHeaderVariant],
      ...dayRows,
      ["주차별합계"],
      ["주간 미팅>계약 성공률"],
    ];
  }

  it("19열 변형('컨택 성공건 수 ▶') — 4개 핵심 지표 이름으로 추출", () => {
    const header19 = [
      "생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "컨택 성공건 수 ▶",
      "미팅예약 기록", "오늘 미팅 일정", "오늘 미팅 수", "미팅 완료 수", "비고",
      "계약건 수", "수임비 금액", "비고", "승인건 수", "수납건 수", "수납금액", "비고",
    ];
    const rows = weekBlock(header19, [
      ["토", "3/21", "매입DB", "3", "3", "2", "1"],
      ["", "", "직접생산"],
      ["", "", "현수막"],
      ["", "", "지-기-소"],
    ]);
    const out = parseLegacySalesRows(rows, YEAR);
    expect(out).toHaveLength(1); // 직접생산·현수막·지-기-소 는 전부 빈 채널행 → skip
    expect(out[0]).toMatchObject({
      rowKey: "2026-03-21:매입DB",
      payload: {
        _backfill: true, date: "2026-03-21", channel: "매입DB",
        production: 3, inflow: 3, contactProgress: 2, meetingReservation: 1,
      },
    });
  });

  it("15열 변형('미팅 예약건 수 ▶') — 같은 4개 지표를 다른 라벨로도 찾는다", () => {
    const header15 = [
      "생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "미팅 예약건 수 ▶",
      "미팅예약 기록", "오늘 미팅 일정", "오늘 미팅 수", "미팅 완료 수", "특이사항(변동,변수)",
      "계약건 수", "수임비 금액", "비고(계약업체명과 수임비 등)",
    ];
    const rows = weekBlock(header15, [
      ["토", "3/21", "매입DB", "5", "4", "3", "2"],
      ["", "", "직접생산"],
      ["", "", "현수막"],
      ["", "", "지-기-소"],
    ]);
    const out = parseLegacySalesRows(rows, YEAR);
    expect(out).toHaveLength(1);
    expect(out[0]!.payload).toMatchObject({
      production: 5, inflow: 4, contactProgress: 3, meetingReservation: 2,
    });
  });

  it("날짜 carry-forward — 매입DB 행에만 날짜, 나머지 3채널은 이어받는다", () => {
    const header = ["생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "컨택 성공건 수 ▶"];
    const rows = weekBlock(header, [
      ["목", "3/26", "매입DB", "4", "1", "1"],
      ["", "", "직접생산", "2", "1"],
      ["", "", "현수막"],
      ["", "", "지-기-소", "1"],
    ]);
    const out = parseLegacySalesRows(rows, YEAR);
    // 매입DB(생산4·유입1·컨택1) + 직접생산(생산2·유입1) + 지-기-소(생산1) = 3건(현수막은 완전 공란 skip)
    expect(out.map((r) => r.rowKey)).toEqual([
      "2026-03-26:매입DB",
      "2026-03-26:직접생산",
      "2026-03-26:콜·지·기·소", // "지-기-소" → 모던 "콜·지·기·소" 정규화
    ]);
    expect(out.every((r) => r.payload.date === "2026-03-26")).toBe(true);
  });

  it("두 주차 — 매 주차 헤더를 다시 읽는다(주차별 컬럼 세트가 달라도 안전)", () => {
    const header = ["생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "컨택 성공건 수 ▶"];
    const week1 = weekBlock(header, [
      ["토", "3/21", "매입DB", "1", "1", "1", "1"],
      ["", "", "직접생산"], ["", "", "현수막"], ["", "", "지-기-소"],
    ]);
    const week2 = [
      ["2주차", "3/28", "~", "4/3"],
      ["요일", "날짜", "채널", "영업 (컨택관리)", "영업 (미팅관리)", "계약관리", "실적관리"],
      ["", "", "", ...header],
      ["토", "3/28", "매입DB", "2", "2", "2", "2"],
      ["", "", "직접생산"], ["", "", "현수막"], ["", "", "지-기-소"],
      ["주차별합계"],
      ["주간 미팅>계약 성공률"],
    ];
    const out = parseLegacySalesRows([...week1, ...week2], YEAR);
    expect(out.map((r) => r.rowKey)).toEqual(["2026-03-21:매입DB", "2026-03-28:매입DB"]);
  });

  it("모든 채널행이 빈 날(4행 전부 공란) → 0건, 에러 없음", () => {
    const header = ["생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "컨택 성공건 수 ▶"];
    const rows = weekBlock(header, [
      ["일", "3/22", "매입DB"], ["", "", "직접생산"], ["", "", "현수막"], ["", "", "지-기-소"],
    ]);
    expect(parseLegacySalesRows(rows, YEAR)).toEqual([]);
  });

  it("빈 시트(헤더조차 없음) → 빈 결과", () => {
    expect(parseLegacySalesRows([], YEAR)).toEqual([]);
  });

  it("row_key 포맷이 모던 sales 와 동일(`{ISO날짜}:{채널}`)", () => {
    const header = ["생산건 수 ▶", "유입건 수 ▶", "컨택진행 수 ▶", "컨택 성공건 수 ▶"];
    const rows = weekBlock(header, [
      ["토", "3/21", "매입DB", "1", "2", "1", "1"],
      ["", "", "직접생산"], ["", "", "현수막"], ["", "", "지-기-소"],
    ]);
    const out = parseLegacySalesRows(rows, YEAR);
    expect(out[0]!.rowKey).toMatch(/^\d{4}-\d{2}-\d{2}:매입DB$/);
  });
});
