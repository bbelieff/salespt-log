/**
 * 단위 테스트: computeDataRows — 영업관리 데이터 행 결정론적 산출.
 *
 * 2026-05-14 사고 후속: 이전 readDataRows 는 C 컬럼이 숫자(날짜 serial)인
 * 행만 데이터 행으로 인식 → C 셀이 비거나 텍스트면 누락 → I~P 수식 안 깔림.
 * computeDataRows 는 시트 구조 공식으로 224행을 항상 정확히 산출.
 *
 * 공식: row = blockStart(10) + (week-1)*blockStride(34) + dayIdx*4 + channelIdx
 *   - sales.ts:salesRowFor 의 쓰기 좌표 공식과 동일 (일관성).
 */
import { describe, it, expect } from "vitest";
import { computeDataRows } from "../../lib/repo/setup-formulas";

describe("computeDataRows — 영업관리 데이터 행 결정론적 산출", () => {
  const rows = computeDataRows();

  it("8주 × 7일 × 4채널 = 224행", () => {
    expect(rows.length).toBe(8 * 7 * 4);
  });

  it("첫 행 = blockStart (10) — 1주차 1일차 채널0", () => {
    expect(rows[0]).toBe(10);
  });

  it("1주차 마지막 행 = 10 + 6*4 + 3 = 37", () => {
    // dayIdx 6, channelIdx 3 → 10 + 27 = 37
    expect(rows[27]).toBe(37);
  });

  it("2주차 첫 행 = 10 + 34 = 44 (blockStride 적용)", () => {
    expect(rows[28]).toBe(44);
  });

  it("마지막 행 = 8주차 7일차 채널3 = 10 + 7*34 + 27 = 275", () => {
    expect(rows[rows.length - 1]).toBe(275);
  });

  it("중복 없음 — 모든 행 번호 unique", () => {
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("오름차순 정렬됨", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!).toBeGreaterThan(rows[i - 1]!);
    }
  });

  it("합계/헤더 행 미포함 — 각 주차 블록의 28행 뒤 6행(38~43 등)은 빠짐", () => {
    // 1주차 블록: 10~43 (34행). 데이터행은 10~37 (28행). 38~43 은 합계/헤더.
    expect(rows).not.toContain(38);
    expect(rows).not.toContain(43);
    // 2주차 블록: 44~77. 데이터 44~71. 72~77 제외.
    expect(rows).not.toContain(72);
    expect(rows).not.toContain(77);
  });

  it("모든 행이 영업관리 범위(10~275) 안", () => {
    for (const r of rows) {
      expect(r).toBeGreaterThanOrEqual(10);
      expect(r).toBeLessThanOrEqual(275);
    }
  });
});
