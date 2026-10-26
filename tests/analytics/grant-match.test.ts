/** 업체 × 공고 판정(2026-10-26 맞춤공고 3단계). 업체·공고 모두 합성 — 실제 공고 문구 꼴만 흉내 냈다. */
import { describe, expect, it } from "vitest";
import { birthYear, matchAnnouncement, matchesFor, parseYmd, yearsInBusiness } from "@/lib/analytics/grant-match";
import { toAnnouncement } from "@/lib/analytics/policy-announcement";
import { PolicyNewsRow } from "@/types/policy-news";

const TODAY = "2026-10-26";
const ann = (o: Record<string, string>) => toAnnouncement(PolicyNewsRow.parse({ 사업명: "가상 자금", 주관기관: "가상재단", 지역: "전국", 마감일: "2026-12-31", ...o }), "2026-10-23");
const 울산제조 = { 소재지: "울산광역시 남구 삼산로 1", 업태: "제조", 업종주생산품목: "금속가공", 사대보험직원: "4명", 개업일: "23.03.02", 대표자생년월일: "1990.05.01" };

describe("지역", () => {
  it.each([
    ["전국", "match"], ["울산", "match"], ["울산 남구", "match"], ["울산 북구", "no"], ["부산", "no"], ["확인안됨", "check"],
  ])("공고 지역 %s → %s", (지역, v) => expect(matchAnnouncement(울산제조, ann({ 지역 }), TODAY).verdict).toBe(v));
  it("업체 지역이 비면 확인 필요, 시·군·구만 비면 확인 필요", () => {
    expect(matchAnnouncement({ 업태: "제조" }, ann({ 지역: "울산" }), TODAY)).toMatchObject({ verdict: "check", reasons: ["업체 지역이 비어 있어요"] });
    expect(matchAnnouncement({ 지역시도: "울산" }, ann({ 지역: "울산 남구" }), TODAY).reasons).toContain("업체 시·군·구가 비어 있어요");
  });
  it("전국 공고라도 지원대상에 지역이 적히면 다른 지역 업체는 뺀다(2026-10-26 belie)", () => {
    const a = ann({ 지원대상: "산업위기지역(여수·서산·울산 남구) 소재 중소기업" });
    expect(matchAnnouncement(울산제조, a, TODAY).verdict).toBe("match");
    expect(matchAnnouncement({ ...울산제조, 소재지: "부산 해운대구 1" }, a, TODAY)).toMatchObject({ verdict: "no", reasons: ["지원대상 지역 다름"] });
  });
});

describe("규모·제외 업종·업종", () => {
  it("소상공인 대상: 맞음 / 아님 / 모름", () => {
    const a = ann({ 지원대상: "울산 소재 소상공인" });
    expect(matchAnnouncement(울산제조, a, TODAY).verdict).toBe("match");
    expect(matchAnnouncement({ ...울산제조, 사대보험직원: "25명" }, a, TODAY)).toMatchObject({ verdict: "no", reasons: ["소상공인 대상"] });
    expect(matchAnnouncement({ ...울산제조, 사대보험직원: "" }, a, TODAY).reasons).toContain("소상공인인지 확인 필요");
  });
  it("「중소기업·소상공인」 같이 적히면 규모로 거르지 않는다", () => {
    expect(matchAnnouncement({ ...울산제조, 사대보험직원: "25명" }, ann({ 지원대상: "중소기업 및 소상공인" }), TODAY).verdict).toBe("match");
  });
  it("제외 업종 업체는 안 맞음", () => {
    expect(matchAnnouncement({ ...울산제조, 제외업종: "예" }, ann({}), TODAY).reasons).toEqual(["제외 업종"]);
  });
  it("업종을 좁힌 공고: 같으면 맞음, 다르면 안 맞음, 업체 대분류를 모를 때만 확인(2026-10-26 belie)", () => {
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "제조업 영위 기업" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "음식점업" }), TODAY).reasons).toEqual(["업종 다름(음식·숙박업)"]);
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "게임·방송·애니메이션 분야" }), TODAY).reasons).toEqual(["업종 다름"]);
    expect(matchAnnouncement({ ...울산제조, 업태: "", 업종주생산품목: "" }, ann({ 업종제한: "게임·방송·애니메이션 분야" }), TODAY).reasons).toContain("업종 조건 확인");
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "전 업종(일부 제한)" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "해당없음" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement(울산제조, ann({ 업종제한: "유흥·사행업 제외" }), TODAY).verdict).toBe("match");
  });
});

describe("특정 업계 공고(제목·지원대상에 적힌 업계) — 2026-10-26 belie", () => {
  const 도소매 = { ...울산제조, 업태: "도소매", 업종주생산품목: "생활용품" };
  it.each([
    [{ 사업명: "가상 에너지이용합리화자금", 지원대상: "에너지 절약시설 설치 사업자, ESCO 투자사업자" }, "업종 다름(에너지)"],
    [{ 사업명: "가상 미래환경산업육성융자", 지원대상: "중소·중견기업" }, "업종 다름(환경산업)"],
    [{ 사업명: "가상 관광진흥개발기금", 지원대상: "관광진흥법상 관광사업 등을 운영 중인 중소기업" }, "업종 다름(관광)"],
  ])("%o → %s", (o, reason) => expect(matchAnnouncement(도소매, ann(o), TODAY).reasons).toContain(reason));
  it("업체가 그 업계면 맞음, 업체 업종을 모르면 확인 필요, 「제외」로만 적힌 업계는 거르지 않는다", () => {
    expect(matchAnnouncement({ ...울산제조, 업태: "숙박", 업종주생산품목: "펜션" }, ann({ 사업명: "가상 관광진흥개발기금" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement({ 소재지: "울산 남구 1" }, ann({ 사업명: "가상 에너지이용합리화자금" }), TODAY).reasons).toContain("에너지 업종인지 확인");
    expect(matchAnnouncement(도소매, ann({ 업종제한: "관광 관련 사업체 제외" }), TODAY).verdict).toBe("match");
  });
});

describe("업력·청년·특성·마감", () => {
  it("업력 N년 이내 / 이상", () => {
    expect(matchAnnouncement(울산제조, ann({ 창업업력제한: "창업 7년 이내" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement(울산제조, ann({ 창업업력제한: "업력 5년 이상" }), TODAY).reasons).toEqual(["업력 5년 안 됨"]);
    expect(matchAnnouncement({ ...울산제조, 개업일: "" }, ann({ 창업업력제한: "3년 미만" }), TODAY).reasons).toEqual(["개업일이 비어 있어요"]);
    expect(matchAnnouncement(울산제조, ann({ 창업업력제한: "확인안됨" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement(울산제조, ann({ 창업업력제한: "해당없음(휴·폐업 제외)" }), TODAY).verdict).toBe("match");
    expect(matchAnnouncement({ ...울산제조, 개업일: "15.01.01" }, ann({ 창업업력제한: "자금별 상이(창업자금은 업력 7년 미만)" }), TODAY).reasons).toEqual(["업력 조건 확인"]);
  });
  it("청년(만 39세 이하) — 생년월일·주민번호 앞자리로 나이를 알면 판정", () => {
    const a = ann({ 특정타겟: "청년 창업자" });
    expect(matchAnnouncement(울산제조, a, TODAY).verdict).toBe("match");
    expect(matchAnnouncement({ ...울산제조, 대표자생년월일: "1970.01.01" }, a, TODAY)).toMatchObject({ verdict: "no", reasons: ["청년(만 39세 이하) 대상"] });
    expect(matchAnnouncement({ ...울산제조, 대표자생년월일: "", 주민등록번호: "740804-" }, a, TODAY).verdict).toBe("no");
    expect(matchAnnouncement({ ...울산제조, 대표자생년월일: "" }, a, TODAY).reasons).toEqual(["대표자 나이 확인 필요"]);
  });
  it("여성기업 대상인데 업체가 안 켰으면 확인 필요(아니라고 단정 안 함)", () => {
    const a = ann({ 지원대상: "여성기업" });
    expect(matchAnnouncement(울산제조, a, TODAY).reasons).toEqual(["여성기업 대상 확인"]);
    expect(matchAnnouncement({ ...울산제조, 공고특성: "여성기업" }, a, TODAY).verdict).toBe("match");
  });
  it("마감 지남은 안 맞음, 7일 이내·예산 소진형은 급함", () => {
    expect(matchAnnouncement(울산제조, ann({ 마감일: "2026-10-20" }), TODAY).reasons).toEqual(["마감 지남"]);
    expect(matchAnnouncement(울산제조, ann({ 마감일: "2026-11-02" }), TODAY).urgent).toBe(true);
    expect(matchAnnouncement(울산제조, ann({ 마감일: "예산 소진 시까지" }), TODAY).urgent).toBe(true);
    expect(matchAnnouncement(울산제조, ann({ 마감일: "2026-12-31" }), TODAY).urgent).toBe(false);
  });
  it("matchesFor: 안 맞음 빼고 급함 → 맞음 → 확인 순", () => {
    const list = [ann({ 사업명: "확인", 지역: "확인안됨" }), ann({ 사업명: "부산", 지역: "부산" }), ann({ 사업명: "맞음" }), ann({ 사업명: "급함", 마감일: "2026-10-28" })];
    expect(matchesFor(울산제조, list, TODAY).map((x) => x.a.title)).toEqual(["급함", "맞음", "확인"]);
    // 확인 필요 공고는 마감이 가까워도 맞는 공고보다 앞에 오지 않는다.
    const urgentCheck = ann({ 사업명: "급한 확인", 지역: "확인안됨", 마감일: "2026-10-28" });
    expect(matchesFor(울산제조, [urgentCheck, ann({ 사업명: "맞음" })], TODAY).map((x) => x.a.title)).toEqual(["맞음", "급한 확인"]);
  });
});

describe("날짜 읽기", () => {
  it("개업일·출생연도", () => {
    expect(parseYmd("25.01.24")).toEqual({ y: 2025, m: 1, d: 24 });
    expect(parseYmd("2025-01-24")).toEqual({ y: 2025, m: 1, d: 24 });
    expect(yearsInBusiness({ 개업일: "" }, TODAY)).toBeNull();
    expect(birthYear({ 대표자생년월일: "900501" }, 2026)).toBe(1990);
    expect(birthYear({ 주민등록번호: "0501013" }, 2026)).toBe(2005);
    expect(birthYear({}, 2026)).toBeNull();
  });
});
