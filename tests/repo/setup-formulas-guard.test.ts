/**
 * 단위 테스트: installFormulas 의 isSafeToOverwrite 가드.
 *
 * 2026-05-14 사고 후속: 사용자가 영업관리 I~P 컬럼에 raw 값 수동 입력했는데
 * installFormulas 가 무조건 수식으로 덮어써 데이터 손실. 재발 차단 위해
 * 셀별 pre-check 도입 — 이 함수의 분기 정확도가 핵심.
 */
import { describe, it, expect } from "vitest";
import {
  computeDataRows,
  isSafeToOverwrite,
} from "../../lib/repo/setup-formulas";

describe("isSafeToOverwrite — 사용자 raw 값 보호 가드", () => {
  describe("안전 (덮어쓰기 OK)", () => {
    it("undefined → 빈 셀이라 safe", () => {
      expect(isSafeToOverwrite(undefined)).toBe(true);
    });
    it("null → 빈 셀이라 safe", () => {
      expect(isSafeToOverwrite(null)).toBe(true);
    });
    it('빈 문자열 "" → safe', () => {
      expect(isSafeToOverwrite("")).toBe(true);
    });
    it('수식 "=COUNTIFS(...)" → 옛 수식 교체 safe', () => {
      expect(isSafeToOverwrite("=COUNTIFS(A:A,1)")).toBe(true);
    });
    it('수식 "=" 만 있어도 safe (edge — 깨진 수식 교체)', () => {
      expect(isSafeToOverwrite("=")).toBe(true);
    });
    it("깨진 수식 결과인 `=#REF!` 같은 경우도 safe (= 로 시작)", () => {
      expect(isSafeToOverwrite("=#REF!")).toBe(true);
    });
  });

  describe("위험 (보존 필요)", () => {
    it("일반 텍스트 → unsafe (사용자 입력 보존)", () => {
      expect(isSafeToOverwrite("미팅 3건")).toBe(false);
    });
    it("숫자 → unsafe (사용자 수동 백필 가능성)", () => {
      expect(isSafeToOverwrite(42)).toBe(false);
    });
    it("0 → unsafe (사용자가 의도적 0 입력 가능)", () => {
      expect(isSafeToOverwrite(0)).toBe(false);
    });
    it('"=" 안 붙은 한글 → unsafe', () => {
      expect(isSafeToOverwrite("계약")).toBe(false);
    });
    it("apostrophe-prefixed (Sheets text mode) → unsafe", () => {
      // Sheets 가 raw text 로 저장할 때 종종 ' 가 붙음. = 안 붙어있어 unsafe 판정.
      expect(isSafeToOverwrite("'meeting")).toBe(false);
    });
    it("boolean (TRUE/FALSE) → unsafe", () => {
      expect(isSafeToOverwrite(true)).toBe(false);
      expect(isSafeToOverwrite(false)).toBe(false);
    });
    it("공백 문자열 → unsafe (사용자 의도 모름)", () => {
      expect(isSafeToOverwrite(" ")).toBe(false);
    });
  });
});

/**
 * 단위 테스트: computeDataRows (2026-05-16, 6기 셀병합 사고 후속).
 *
 * 시트 C 컬럼 read 의존 제거 → 박힌 공식으로 결정적 row 생성. 6기 이월 시트의
 * C 컬럼 cell 병합으로 매입DB row 만 인식되던 사고 원천 차단.
 *
 * 공식: row = blockStart(10) + week*blockStride(34) + dayIdx*4 + channelIdx
 */
describe("computeDataRows — deterministic data row 생성", () => {
  const rows = computeDataRows();

  it("8주 × 7일 × 4채널 = 224 rows 반환", () => {
    expect(rows.length).toBe(8 * 7 * 4);
  });

  it("첫 row = blockStart(10) (1주 1일 매입DB)", () => {
    expect(rows[0]).toBe(10);
  });

  it("1주 1일 4채널 row 연속: 10, 11, 12, 13", () => {
    expect(rows.slice(0, 4)).toEqual([10, 11, 12, 13]);
  });

  it("1주 2일 첫 매입DB row = 14 (stride 4)", () => {
    expect(rows[4]).toBe(14);
  });

  it("2주 1일 매입DB row = blockStart + blockStride = 44", () => {
    // 1주 = 28 rows (7일 × 4채널) → idx 28 이 2주 1일 매입DB
    expect(rows[28]).toBe(44);
  });

  it("마지막 row = blockStart + 7*blockStride + 6*4 + 3 = 275", () => {
    // 8주 7일 콜·지·기·소 = 10 + 7*34 + 6*4 + 3 = 10+238+24+3 = 275
    expect(rows[rows.length - 1]).toBe(275);
  });

  it("중복 없음 + 오름차순", () => {
    const sorted = [...rows].sort((a, b) => a - b);
    expect(rows).toEqual(sorted);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("합계/헤더 row 미포함 — 매 블록 offset 0~27 만 (28~33 제외)", () => {
    for (const r of rows) {
      const offset = (r - 10) % 34;
      expect(offset).toBeLessThanOrEqual(27);
    }
  });

  it("6기 cell 병합 시나리오 — readDataRows 시절 매입DB row 만 인식되던 사고 재발 방지", () => {
    // 1주 1일 4채널 row 가 모두 dataRows 에 있어야 함 (cell 병합 무관).
    expect(rows).toContain(10); // 매입DB
    expect(rows).toContain(11); // 직접생산 — 6기 시트에서 누락됐던 row
    expect(rows).toContain(12); // 현수막
    expect(rows).toContain(13); // 콜·지·기·소
  });
});
