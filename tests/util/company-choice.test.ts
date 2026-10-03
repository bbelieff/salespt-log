/**
 * 업체정보 선택형 칸 해석 (company-info-restructure, belie 2026-09-28) — 순수 함수.
 *  ① 사업자구분 · 과세유형 한 칸: 조합 선택지 ↔ 두 저장 키, 옛 값은 "지금 값" 선택지로 보존
 *  ② 소유여부: 옛 자유 글에서 자가/임차 짐작 + 원문 보존
 *  ③ 원 금액 입력 쉼표 · 단위 표시 여부 · 메모 덧붙이기
 */
import { describe, expect, it } from "vitest";
import {
  BIZ_TYPE_CURRENT,
  BIZ_TYPE_OPTIONS,
  appendMemoLine,
  bizTypeChoose,
  bizTypeView,
  formatWonInput,
  isCorporation,
  ownershipView,
  showsUnitSuffix,
} from "@/util/company-choice";

describe("① 사업자구분 · 과세유형", () => {
  it("선택지 5개 = belie 확정 순서", () => {
    expect(BIZ_TYPE_OPTIONS.map((o) => o.label)).toEqual([
      "개인 · 일반과세",
      "개인 · 간이과세",
      "개인 · 면세",
      "법인 · 일반과세",
      "법인 · 면세",
    ]);
  });

  it("저장된 두 칸 → 선택지(사업자등록증 표기·줄임말도 같은 뜻)", () => {
    expect(bizTypeView("개인", "일반과세자")).toEqual({ value: "개인|일반과세자", current: null });
    expect(bizTypeView("법인사업자", "면세").value).toBe("법인|면세사업자");
    expect(bizTypeView("", "")).toEqual({ value: "", current: null });
  });

  it("과세유형이 빈 옛 값 → 고를 수 없는 '개인 · 과세유형 선택' 이 선택된 채 보인다", () => {
    expect(bizTypeView("개인", "")).toEqual({
      value: BIZ_TYPE_CURRENT,
      current: { value: BIZ_TYPE_CURRENT, label: "개인 · 과세유형 선택" },
    });
    expect(bizTypeView("", "간이과세자").current?.label).toBe("구분 선택 · 간이과세");
  });

  it("모르는 자유 글·목록 밖 조합은 글 그대로", () => {
    expect(bizTypeView("개인(공동대표)", "").current?.label).toBe("개인(공동대표) · 과세유형 선택");
    expect(bizTypeView("법인", "간이과세자").current?.label).toBe("법인 · 간이과세");
  });

  it("고르면 두 키를 함께 — 뜻이 옮겨지지 않는 옛 글은 lost 로 돌려준다", () => {
    expect(bizTypeChoose("법인|일반과세자", { 사업자구분: "개인", 과세유형: "" })).toEqual({
      사업자구분: "법인",
      과세유형: "일반과세자",
      lost: [],
    });
    expect(bizTypeChoose("개인|면세사업자", { 사업자구분: "개인(공동대표)", 과세유형: "영세" })).toEqual({
      사업자구분: "개인",
      과세유형: "면세사업자",
      lost: ["사업자구분: 개인(공동대표)", "과세유형: 영세"],
    });
    expect(bizTypeChoose("", { 사업자구분: "법인", 과세유형: "일반과세자" })).toEqual({
      사업자구분: "",
      과세유형: "",
      lost: [],
    });
    expect(bizTypeChoose(BIZ_TYPE_CURRENT, { 사업자구분: "개인", 과세유형: "" })).toBeNull();
  });

  it("법인 판정 — 법인등록번호 칸 표시 조건", () => {
    expect(isCorporation("법인")).toBe(true);
    expect(isCorporation("법인사업자")).toBe(true);
    expect(isCorporation("개인")).toBe(false);
    expect(isCorporation("")).toBe(false);
  });
});

describe("② 소유여부", () => {
  it.each([
    ["", "", ""],
    ["자가", "자가", ""],
    ["임차", "임차", ""],
    ["임차 : 보 1000만, 월 50만", "임차", "임차 : 보 1000만, 월 50만"],
    ["자가 / 임차 : 보 00만, 월 00만", "자가", "자가 / 임차 : 보 00만, 월 00만"],
    ["월세 50만", "임차", "월세 50만"],
    ["모름", "", "모름"],
  ])("%s → 선택 %s", (raw, choice, legacy) => {
    expect(ownershipView(raw)).toEqual({ choice, legacy });
  });
});

describe("③ 금액 입력 · 단위 · 메모", () => {
  it("숫자·쉼표만 친 입력만 천 단위 쉼표로", () => {
    expect(formatWonInput("10000000")).toBe("10,000,000");
    expect(formatWonInput("1,0000")).toBe("10,000");
    expect(formatWonInput("0")).toBe("0");
    expect(formatWonInput("1,000만")).toBe("1,000만"); // 옛 값은 그대로
    expect(formatWonInput("")).toBe("");
  });
  it("단위는 비었거나 숫자뿐일 때만 붙인다", () => {
    expect(showsUnitSuffix("")).toBe(true);
    expect(showsUnitSuffix("10,000,000")).toBe(true);
    expect(showsUnitSuffix("33.1")).toBe(true);
    expect(showsUnitSuffix("1,000만")).toBe(false);
    expect(showsUnitSuffix("33㎡(10평)")).toBe(false);
  });
  it("기타메모 끝에 한 줄", () => {
    expect(appendMemoLine("", "a")).toBe("a");
    expect(appendMemoLine("기존\n", "a")).toBe("기존\na");
  });
});
