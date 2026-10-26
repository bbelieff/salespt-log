/** 메모 → 부재 담기·컨택결과 제안(2026-10-26 belie). 꼴은 실제 공급처 메모를 흉내 냈고 내용은 가상. */
import { describe, expect, it } from "vitest";
import { memoSuggestion } from "@/lib/analytics/db-sheet-memo";

const TODAY = "2026-10-26";
const lead = (memoLine: string, extra: Record<string, unknown> = {}) => ({ memo: `비고: 연습용\n메모: ${memoLine}\n[가져온 원문]\n | x`, date: "2026-09-22", ...extra });

describe("메모에서 찾은 부재", () => {
  it("날짜 있는 부재만, 이미 담은 날짜·미래 날짜는 빼고", () => {
    expect(memoSuggestion(lead("인천남동구(가상펍)/부재중1 /부재중1014 /계속 부재1015"), TODAY).absenceDates).toEqual(["2026-10-14", "2026-10-15"]);
    expect(memoSuggestion(lead("인천남동구(가상펍)/부재중1014 /계속 부재1015", { absences: [{ date: "2026-10-14", hour: 10 }] }), TODAY).absenceDates).toEqual(["2026-10-15"]);
    expect(memoSuggestion(lead("수원시(가상꽃집)/ 부재중1"), TODAY).absenceDates).toEqual([]);
  });
});

describe("컨택결과 제안 — 마지막으로 적은 말 기준", () => {
  it.each([
    ["서울강남구(가상네일)  //부재중1 /필요없다하고 바로 끊어버림X", "단순거절"],
    ["인천(가상식당)/부재중1 아예거절1015", "단순거절"],
    ["부천시(가상차고)/대출인줄 알았어요 안할게요라고 했습니다 자금 필요여부 확인했는데 완강히 거부", "상담 후 거절"],
    ["서울송파구(가상상회) / 대출이면 괜찮다로 안하고싶다라고 마무리", "상담 후 거절"],
    ["서울서대문구(가상상회)/ 부재중1/16일 금요일 다시 연락주시겠다하심/", "재통화"],
    ["서울은평구(가상식당 상암점)/없는번호..ㅠㅠ AS", "AS예정"],
  ])("%s → %s", (line, value) => expect(memoSuggestion(lead(line), TODAY).result?.value).toBe(value));
  it("통화 날짜(끝 MMDD)가 있으면 그날, 없으면 오늘", () => {
    expect(memoSuggestion(lead("인천(가상식당)/부재중1 아예거절1015"), TODAY).result?.date).toBe("2026-10-15");
    expect(memoSuggestion(lead("서울양천구(가상학원)/괜찮다고 끊으심.."), TODAY).result?.date).toBe(TODAY);
  });
  it("미팅 얘기가 마지막이거나 알 수 없는 말이면 제안 없음", () => {
    expect(memoSuggestion(lead("서울서대문구(가상공방)/ 21일 1시 미팅 예정/미팅후 답변없음."), TODAY).result).toBeNull();
    expect(memoSuggestion(lead("서울강서구(가상컨설팅)"), TODAY).result).toBeNull();
    expect(memoSuggestion({ memo: "", date: "2026-09-22" }, TODAY)).toEqual({ absenceDates: [], result: null });
  });
});
