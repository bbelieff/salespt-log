/**
 * BBE-67(R7-#18) 5기 legacy 어댑터 순수 로직 회귀.
 * census 근거 = docs/plans/active/bbe67-legacy-5gi-adapter.md §2(row/column 실측).
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_CONTRACT_TAB,
  LEGACY_CONTRACT_FIRST_DATA_ROW,
  LEGACY_DB_SECTIONS,
  isLegacyDbSectionTotalRow,
  LEGACY_SALES_CHANNELS,
  LEGACY_SALES_WEEK_STRIDE,
  LEGACY_SALES_FIRST_ROW,
  legacySalesBlockRow,
} from "../../scripts/ops/backfill-sheet-rows-legacy.mjs";

describe("계약관리(5기, 번호 없음)", () => {
  it("탭 이름·첫 데이터 행이 census 실측과 일치", () => {
    expect(LEGACY_CONTRACT_TAB).toBe("계약관리");
    // row10=헤더 · row11=예시행 · row12+=실데이터 — census 로 확정(G작업원D 서술 검증).
    expect(LEGACY_CONTRACT_FIRST_DATA_ROW).toBe(12);
  });
});

describe("DB관리(5기, 번호 없음) 섹션 좌표", () => {
  it("4섹션 전부 census 실측 좌표를 담고 있다(매입DB·직접생산 나란히, 현수막·지인 은 아래로)", () => {
    expect(LEGACY_DB_SECTIONS).toHaveLength(4);
    expect(LEGACY_DB_SECTIONS.map((s) => s.name)).toEqual([
      "매입DB", "직접생산", "현수막", "지인기고객소개",
    ]);
    const 매입DB = LEGACY_DB_SECTIONS.find((s) => s.name === "매입DB")!;
    const 직접생산 = LEGACY_DB_SECTIONS.find((s) => s.name === "직접생산")!;
    // 매입DB·직접생산은 같은 행 범위(나란히 배치) — 컬럼만 다르다.
    expect(매입DB.rowStart).toBe(직접생산.rowStart);
    expect(매입DB.c1).not.toBe(직접생산.c1);

    const 현수막 = LEGACY_DB_SECTIONS.find((s) => s.name === "현수막")!;
    const 지인 = LEGACY_DB_SECTIONS.find((s) => s.name === "지인기고객소개")!;
    // 현수막·지인은 매입DB 아래로 쌓인다(행 시작이 뒤로 갈수록 커짐).
    expect(현수막.rowStart).toBeGreaterThan(매입DB.rowStart);
    expect(지인.rowStart).toBeGreaterThan(현수막.rowStart);
  });

  it("각 섹션은 컬럼 시작(c1)이 유일하다 — 중복 좌표로 같은 셀을 두 섹션이 읽지 않는다", () => {
    const c1s = LEGACY_DB_SECTIONS.map((s) => `${s.rowStart}:${s.c1}`);
    expect(new Set(c1s).size).toBe(c1s.length);
  });
});

describe("isLegacyDbSectionTotalRow — '합계' 행에서만 멈춘다(빈 슬롯과는 다르다)", () => {
  it("정확히 '합계' 만 종료 신호", () => {
    expect(isLegacyDbSectionTotalRow("합계")).toBe(true);
  });

  it("빈 셀은 종료가 아니다 — 데이터와 합계 사이의 미사용 슬롯일 수 있다(census 실측)", () => {
    expect(isLegacyDbSectionTotalRow("")).toBe(false);
    expect(isLegacyDbSectionTotalRow("  ")).toBe(false);
    expect(isLegacyDbSectionTotalRow(undefined)).toBe(false);
  });

  it("실데이터(날짜·업체명 등)는 종료가 아니다", () => {
    expect(isLegacyDbSectionTotalRow("2026-03-05")).toBe(false);
    expect(isLegacyDbSectionTotalRow("주식회사아무개")).toBe(false);
    expect(isLegacyDbSectionTotalRow(46107)).toBe(false); // 시리얼 날짜
  });
});

describe("영업관리(5기, 번호 없음) — 채널·주차 stride", () => {
  it("4번째 채널은 원문('지-기-소') 그대로 — '콜' 을 지어내지 않는다", () => {
    expect(LEGACY_SALES_CHANNELS).toEqual(["매입DB", "직접생산", "현수막", "지-기-소"]);
  });

  it("주차 stride·첫 행이 census 실측(r8→r42 34행 간격)과 일치", () => {
    expect(LEGACY_SALES_WEEK_STRIDE).toBe(34);
    expect(LEGACY_SALES_FIRST_ROW).toBe(10);
  });
});

describe("legacySalesBlockRow — (주차,요일,채널) → 물리 행", () => {
  it("1주차 첫 요일·첫 채널 = row10(census 실측: 매입DB 라벨이 있던 행)", () => {
    expect(legacySalesBlockRow(1, 0, 0)).toBe(10);
  });

  it("같은 요일 블록 안에서 채널 4개는 연속 행", () => {
    expect(legacySalesBlockRow(1, 0, 1)).toBe(11);
    expect(legacySalesBlockRow(1, 0, 2)).toBe(12);
    expect(legacySalesBlockRow(1, 0, 3)).toBe(13);
  });

  it("2주차 첫 행 = row44(census 실측: r8 헤더 → r42 헤더 재현, 34행 간격)", () => {
    expect(legacySalesBlockRow(2, 0, 0)).toBe(44);
  });

  it("현행 코드의 공식(10 + (w-1)*34 + d*4 + c)과 동일 결과", () => {
    for (let w = 1; w <= 3; w++) {
      for (let d = 0; d < 7; d++) {
        for (let c = 0; c < 4; c++) {
          expect(legacySalesBlockRow(w, d, c)).toBe(10 + (w - 1) * 34 + d * 4 + c);
        }
      }
    }
  });
});
