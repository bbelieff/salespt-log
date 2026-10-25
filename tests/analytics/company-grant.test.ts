/** 맞춤공고 업체 특성 계산(2026-10-25 belie 승인 목업) — 지역·대분류·제외 업종·공고 특성·소상공인·준비 n/3. 값은 모두 가상. */
import { describe, expect, it } from "vitest";
import { parseRegion, SIGUNGU, SIDO } from "@/util/admin-regions";
import { deriveExcluded, deriveFeatures, deriveIndustry, employeeCount, grantProfile, isSmallBusiness } from "@/lib/analytics/company-grant";

describe("지역 — 소재지에서 시·도 / 시·군·구", () => {
  it.each([
    ["울산광역시 남구 삼산로 123, 2층", "울산", "남구"],
    ["서울 강남구 테헤란로 1", "서울", "강남구"],
    ["경기도 수원시 장안구 정자로 10", "경기", "수원시"],
    ["경상남도창원시의창구 중앙대로 1", "경남", "창원시"],
    ["경기 광주시 오포읍 1", "경기", "광주시"],
    ["광주광역시 북구 첨단로 1", "광주", "북구"],
    ["강원도 춘천시 중앙로 1", "강원", "춘천시"],
    ["전라북도 전주시 완산구 1", "전북", "전주시"],
    ["대구광역시 군위군 군위읍 1", "대구", "군위군"],
    ["인천광역시 제물포구 1", "인천", "제물포구"],
    ["세종특별자치시 한누리대로 1", "세종", ""],
    ["수원시 팔달구 1", "경기", "수원시"],
    ["광주시 오포읍 1", "경기", "광주시"],
  ])("%s → %s %s", (addr, sido, sgg) => {
    expect(parseRegion(addr)).toEqual({ 시도: sido, 시군구: sgg });
  });
  it("시·도 없이 여러 곳에 있는 이름(중구)은 비운다 · 빈 글은 빈 값", () => {
    expect(parseRegion("중구 을지로 1")).toEqual({ 시도: "", 시군구: "" });
    expect(parseRegion("")).toEqual({ 시도: "", 시군구: "" });
  });
  it("행정구역 표: 시·도 17, 세종 외에는 시·군·구가 있다", () => {
    expect(SIDO).toHaveLength(17);
    for (const s of SIDO) if (s !== "세종") expect(SIGUNGU[s].length).toBeGreaterThan(0);
  });
});

describe("대분류·제외 업종·특성", () => {
  it.each([
    ["제조", "", "", "제조업"], ["도소매", "", "", "도소매업"], ["음식점업", "한식", "", "음식·숙박업"],
    ["", "소프트웨어 개발", "", "정보통신"], ["건설업", "", "", "건설업"], ["운수업", "화물", "", "운수업"],
    ["서비스", "미용", "", "그 밖의 서비스업"], ["", "", "", ""],
  ])("업태 %s · 업종 %s → %s", (a, b, c, out) => expect(deriveIndustry(a, b, c)).toBe(out));
  it("제외 업종 낱말이면 미리 켠다", () => {
    expect(deriveExcluded("숙박 및 음식점업", "유흥주점")).toBe(true);
    expect(deriveExcluded("부동산업", "부동산 임대")).toBe(true);
    expect(deriveExcluded("제조", "금속가공")).toBe(false);
  });
  it("특허 및 인증 글에서 벤처·이노비즈·메인비즈", () => {
    expect(deriveFeatures("벤처, ISO9001, 메인비즈")).toEqual(["벤처", "메인비즈"]);
    expect(deriveFeatures("특허 2건")).toEqual([]);
  });
  it("소상공인: 제조 10명 미만 · 그 밖 5명 미만 · 모르면 null", () => {
    expect(employeeCount("4명 + 프리2명")).toBe(4);
    expect(isSmallBusiness("제조업", 9)).toBe(true);
    expect(isSmallBusiness("도소매업", 5)).toBe(false);
    expect(isSmallBusiness("", 3)).toBeNull();
    expect(isSmallBusiness("제조업", null)).toBeNull();
  });
});

describe("grantProfile — 직접 고른 값 우선, 비면 계산", () => {
  const base = { 소재지: "울산광역시 남구 삼산로 123", 업태: "제조", 업종주생산품목: "금속가공", 사대보험직원: "4명", 특허및인증: "벤처" };
  it("자동: 지역·대분류·특성·준비 3/3", () => {
    const p = grantProfile(base);
    expect(p).toMatchObject({ region: { 시도: "울산", 시군구: "남구" }, regionAuto: true, industry: "제조업", industryAuto: true, excluded: false, excludedAuto: true, features: ["벤처"], autoFeatures: ["벤처"], smallBusiness: true, ready: 3 });
  });
  it("★직접 고른 지역·대분류는 소재지·업태가 바뀌어도 그대로", () => {
    const p = grantProfile({ ...base, 소재지: "서울 중구 1", 지역시도: "부산", 지역시군구: "해운대구", 대분류: "도소매업" });
    expect(p).toMatchObject({ region: { 시도: "부산", 시군구: "해운대구" }, regionAuto: false, industry: "도소매업", industryAuto: false });
  });
  it("제외 업종 직접 지정·공고 특성 직접 선택", () => {
    const p = grantProfile({ ...base, 제외업종: "예", 공고특성: "여성기업,수출(직접),없는칩" });
    expect(p.excluded).toBe(true);
    expect(p.excludedAuto).toBe(false);
    expect(p.features).toEqual(["여성기업", "수출(직접)", "벤처"]);
  });
  it("모르는 것은 준비 수에서 빠진다", () => {
    expect(grantProfile({}).ready).toBe(0);
    expect(grantProfile({ 소재지: "경기도 화성시 1" }).ready).toBe(1);
  });
});
