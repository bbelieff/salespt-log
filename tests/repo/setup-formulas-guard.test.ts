/**
 * 단위 테스트: installFormulas 의 isSafeToOverwrite 가드.
 *
 * 2026-05-14 사고 후속: 사용자가 영업관리 I~P 컬럼에 raw 값 수동 입력했는데
 * installFormulas 가 무조건 수식으로 덮어써 데이터 손실. 재발 차단 위해
 * 셀별 pre-check 도입 — 이 함수의 분기 정확도가 핵심.
 */
import { describe, it, expect } from "vitest";
import { isSafeToOverwrite } from "../../lib/repo/setup-formulas";

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
