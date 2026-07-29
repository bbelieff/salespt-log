/**
 * 아레나 시즌 SSOT 회귀 (AR-2b, 8/7 시즌2 개막 경로).
 *
 * 고정하는 계약:
 *  ① 현재 시즌 = **개막한**(courseStart<=오늘) 아레나 기수 중 최대 시즌 — A2 개막일에 자동 전환.
 *  ② **등록 ≠ 개막**: 사전등록(prep)·미개막 기수는 시즌을 넘기지 못한다(개막 전 조기 전환 차단).
 *  ③ 테스터(A{n}-0)는 시즌을 넘기지 못한다(스모크테스트 1행이 전광판을 뒤집는 사고 차단).
 *  ④ 집계 스코프(isInSeason)는 라벨과 **같은 SSOT** — 헤더는 시즌2인데 표는 시즌1인 자기모순 금지.
 *  ⑤ 시즌 미상(0)이면 스코프는 전부 통과 = 보드를 비우지 않는다(안전 degrade).
 *  ⑥ 이월 판정(isCarryoverContract)은 시즌 경계가 바뀌어도 같은 규칙(집계 경로 자체는
 *     contract-carryover-split.test.ts 가 덮는다 — 여기선 경계 규칙만 고정).
 *
 * 날짜는 **테스트 픽스처**로만 등장한다(앱 코드 하드코딩 금지 — 구조테스트 G5 가 강제).
 */
import { describe, expect, it } from "vitest";
import {
  isInSeason,
  resolveCurrentSeason,
  seasonDisplayLabel,
} from "../../lib/service/arena-season-config";
import { isCarryoverContract } from "../../lib/types/contract-status";

const S1_START = "2026-06-12"; // 시즌1 개막(픽스처)
const S2_START = "2026-08-07"; // 시즌2 개막(픽스처)

const p = (cohort: string, courseStartISO?: string) => ({ cohort, courseStartISO });

describe("resolveCurrentSeason — 개막 기준 시즌 판정", () => {
  it("A1 만 개막 → 시즌1", () => {
    const parts = [p("A1-1기", S1_START), p("A1-6기", S1_START)];
    expect(resolveCurrentSeason(parts, "2026-07-20")).toBe(1);
  });

  it("**개막일에 시즌2 자동 전환** (A2 courseStart <= 오늘)", () => {
    const parts = [p("A1-1기", S1_START), p("A2-1기", S2_START)];
    expect(resolveCurrentSeason(parts, S2_START)).toBe(2);
  });

  it("**등록 ≠ 개막**: A2 사전등록돼 있어도 개막 전이면 여전히 시즌1", () => {
    const parts = [p("A1-1기", S1_START), p("A2-1기", S2_START)];
    expect(resolveCurrentSeason(parts, "2026-08-06")).toBe(1);
    expect(resolveCurrentSeason(parts, "2026-07-01")).toBe(1);
  });

  it("**테스터(A{n}-0)는 시즌을 넘기지 못한다** — 스모크테스트 행 1개로 전광판 뒤집힘 차단", () => {
    const parts = [p("A1-1기", S1_START), p("A2-0기", S1_START)];
    expect(resolveCurrentSeason(parts, S2_START)).toBe(1);
  });

  it("**날짜 미상은 시즌을 올리지 못한다**(fail-closed) — 개강일 미기록 아레나 행 대비", () => {
    // create-arena-members 가 개강일을 안 써서 registry K 가 "" 인 행이 실재한다.
    // 이때 A2 를 '개막'으로 인정하면 첫 클레임만으로 시즌2가 되어 시즌1 보드가 사라진다.
    expect(resolveCurrentSeason([p("A1-1기", S1_START), p("A2-1기")], S2_START)).toBe(1);
    expect(resolveCurrentSeason([p("A1-1기", S1_START), p("A2-1기", "")], S2_START)).toBe(1);
    expect(resolveCurrentSeason([p("A1-1기", S1_START), p("A2-1기", "8/7")], S2_START)).toBe(1);
  });

  it("전부 날짜 미상 → 0(미상) — 라벨은 '아레나', 스코프는 전체 통과(데이터 안 자름)", () => {
    expect(resolveCurrentSeason([p("A1-1기"), p("A2-1기")], S2_START)).toBe(0);
    expect(isInSeason("A1-1기", 0)).toBe(true); // 스코프 미적용 확인
  });

  it("'기' 접미사 유무 무관 (파서 재사용 계약)", () => {
    expect(resolveCurrentSeason([p("A2-1", S2_START)], S2_START)).toBe(2);
    expect(resolveCurrentSeason([p("A2-1기", S2_START)], S2_START)).toBe(2);
  });

  it("비아레나·빈 라벨은 무시 — 섞여 있어도 시즌 오염 없음", () => {
    const parts = [p("8기"), p(""), p("T"), p("연습"), p("A1-3기", S1_START)];
    expect(resolveCurrentSeason(parts, S2_START)).toBe(1);
  });

  it("참가자 없음/전부 비아레나 → 0(미상)", () => {
    expect(resolveCurrentSeason([], S2_START)).toBe(0);
    expect(resolveCurrentSeason([p("8기"), p("9기")], S2_START)).toBe(0);
  });

  it("시즌 두 자리도 정상 (A10 > A9 — 문자열 비교 아님)", () => {
    const parts = [p("A9-1기", S1_START), p("A10-1기", S1_START)];
    expect(resolveCurrentSeason(parts, S2_START)).toBe(10);
  });
});

describe("isInSeason — 집계 스코프(라벨과 같은 SSOT)", () => {
  it("해당 시즌 기수만 통과 — 옛 시즌 행은 보드에서 제외", () => {
    expect(isInSeason("A2-1기", 2)).toBe(true);
    expect(isInSeason("A1-6기", 2)).toBe(false);
  });

  it("'기' 접미사 유무 무관", () => {
    expect(isInSeason("A2-3", 2)).toBe(true);
  });

  it("비아레나 라벨은 시즌 스코프에서 제외", () => {
    expect(isInSeason("8기", 2)).toBe(false);
    expect(isInSeason("", 2)).toBe(false);
  });

  it("**시즌 미상(0)이면 전부 통과** — 보드를 비우지 않는다(degrade)", () => {
    expect(isInSeason("A1-1기", 0)).toBe(true);
    expect(isInSeason("8기", 0)).toBe(true);
  });

  it("헤더-표 정합: resolveCurrentSeason 이 준 시즌으로 거른 결과만 남는다", () => {
    const parts = [p("A1-1기", S1_START), p("A2-1기", S2_START), p("A2-2기", S2_START)];
    const season = resolveCurrentSeason(parts, S2_START);
    const scoped = parts.filter((u) => isInSeason(u.cohort, season));
    expect(season).toBe(2);
    expect(scoped.map((u) => u.cohort)).toEqual(["A2-1기", "A2-2기"]);
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

describe("이월 판정 — 시즌 경계 규칙", () => {
  it("깃발(구분='이월') 행은 이월로 분류", () => {
    expect(
      isCarryoverContract({ 구분: "이월", 계약일: "2026-08-20" }, S2_START),
    ).toBe(true);
  });

  it("시즌2 시작 **이전** 계약은 깃발이 없어도 이월로 분류", () => {
    expect(isCarryoverContract({ 계약일: "2026-07-30" }, S2_START)).toBe(true);
  });

  it("개막 당일·이후 계약은 신규(집계 대상)", () => {
    expect(isCarryoverContract({ 계약일: S2_START }, S2_START)).toBe(false);
    expect(isCarryoverContract({ 계약일: "2026-08-08" }, S2_START)).toBe(false);
  });

  it("같은 계약이 시즌1 기준 신규 / 시즌2 기준 이월 — 경계 전환 규칙", () => {
    const c = { 계약일: "2026-07-01" };
    expect(isCarryoverContract(c, S1_START)).toBe(false);
    expect(isCarryoverContract(c, S2_START)).toBe(true);
  });

  it("날짜가 ISO 가 아니면 날짜 비교를 하지 않는다(깃발만 판정)", () => {
    expect(isCarryoverContract({ 계약일: "8/1" }, S2_START)).toBe(false);
    expect(isCarryoverContract({ 구분: "이월", 계약일: "8/1" }, S2_START)).toBe(true);
  });
});
