/**
 * 아레나 시즌 SSOT + 이월 비집계 회귀 (AR-2b, 8/7 시즌2 개막 경로).
 *
 * 고정하는 계약:
 *  ① 현재 시즌 = 참가자 cohort 의 **최대 시즌** — A2 등록 즉시 시즌2 (코드 수정 불필요).
 *  ② 시즌 번호·날짜 **하드코딩 0** — 입력 데이터만으로 결정.
 *  ③ 표기는 seasonDisplayLabel 단일 규칙(미상이면 "아레나").
 *  ④ **이월 비집계**: 시즌이 넘어가도 이월 계약(깃발 OR 시작일 이전)은 새 시즌 집계에서 빠진다.
 */
import { describe, expect, it } from "vitest";
import {
  resolveCurrentSeason,
  seasonDisplayLabel,
} from "../../lib/service/arena-season-config";
import { isCarryoverContract } from "../../lib/types/contract-status";

describe("resolveCurrentSeason — 시즌 SSOT", () => {
  it("A1 만 있으면 시즌1", () => {
    expect(resolveCurrentSeason(["A1-1기", "A1-2기", "A1-6기"])).toBe(1);
  });

  it("**A2 등록 즉시 시즌2** (최대 시즌 채택 — 개막 자동 전환)", () => {
    expect(resolveCurrentSeason(["A1-1기", "A1-6기", "A2-1기"])).toBe(2);
  });

  it("'기' 접미사 유무 무관 (파서 재사용 계약)", () => {
    expect(resolveCurrentSeason(["A2-1"])).toBe(2);
    expect(resolveCurrentSeason(["A2-1기"])).toBe(2);
  });

  it("비아레나·빈 라벨은 무시 — 섞여 있어도 시즌 오염 없음", () => {
    expect(resolveCurrentSeason(["8기", "", "T", "연습", "A1-3기"])).toBe(1);
  });

  it("참가자 없음/전부 비아레나 → 0(미상)", () => {
    expect(resolveCurrentSeason([])).toBe(0);
    expect(resolveCurrentSeason(["8기", "9기"])).toBe(0);
  });

  it("시즌 두 자리도 정상 (A10 > A9 — 문자열 비교 아님)", () => {
    expect(resolveCurrentSeason(["A9-1기", "A10-1기"])).toBe(10);
  });

  it("테스터(A{n}-0)도 시즌 판정에 포함 — 시즌 자체는 같다", () => {
    expect(resolveCurrentSeason(["A2-0기"])).toBe(2);
  });
});

describe("seasonDisplayLabel — 표기 단일 규칙", () => {
  it("시즌 번호가 있으면 '아레나 시즌N'", () => {
    expect(seasonDisplayLabel(1)).toBe("아레나 시즌1");
    expect(seasonDisplayLabel(2)).toBe("아레나 시즌2");
  });

  it("미상(0)이면 번호 없이 '아레나' — 옛 '시즌1' 하드코딩 fallback 금지", () => {
    expect(seasonDisplayLabel(0)).toBe("아레나");
  });
});

describe("이월 비집계 — 시즌 전환 회귀", () => {
  const S2_START = "2026-08-07"; // 시즌2 개막(테스트 픽스처 — 런타임은 시트 O1 동적값)

  it("깃발(구분='이월') 행은 새 시즌 집계에서 제외", () => {
    expect(
      isCarryoverContract({ 구분: "이월", 계약일: "2026-08-20" }, S2_START),
    ).toBe(true);
  });

  it("시즌2 시작 **이전** 계약은 깃발이 없어도 제외(이월로 분류)", () => {
    expect(isCarryoverContract({ 계약일: "2026-07-30" }, S2_START)).toBe(true);
  });

  it("시즌2 시작 **이후** 신규 계약은 집계에 포함", () => {
    expect(isCarryoverContract({ 계약일: "2026-08-08" }, S2_START)).toBe(false);
  });

  it("개막 당일 계약은 포함(경계: 시작일 미만만 이월)", () => {
    expect(isCarryoverContract({ 계약일: S2_START }, S2_START)).toBe(false);
  });

  it("시즌1 때 집계되던 계약이 시즌2 기준으로는 이월 처리된다(전환 회귀)", () => {
    const s1Start = "2026-06-12";
    const c = { 계약일: "2026-07-01" };
    expect(isCarryoverContract(c, s1Start)).toBe(false); // 시즌1 집계 O
    expect(isCarryoverContract(c, S2_START)).toBe(true); // 시즌2 집계 X
  });

  it("날짜가 ISO 가 아니면 날짜 비교를 하지 않는다(깃발만 판정)", () => {
    expect(isCarryoverContract({ 계약일: "8/1" }, S2_START)).toBe(false);
    expect(isCarryoverContract({ 구분: "이월", 계약일: "8/1" }, S2_START)).toBe(true);
  });
});
