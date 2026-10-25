/** 정책자금뉴스 줄 → 공고(2026-10-26 맞춤공고 2단계). 합성 줄만 — 실제 공고 문구 꼴을 흉내 냈다. */
import { describe, expect, it } from "vitest";
import { announcementId, isClosed, mergeAnnouncements, parseDeadline, parseScopes } from "@/lib/analytics/policy-announcement";
import { PolicyNewsDay } from "@/types/policy-news";

const row = (o: Record<string, string>) => ({ 사업명: "가상 정책자금", 주관기관: "가상재단", 지역: "전국", 마감일: "확인안됨", 공고원문링크: "", ...o });

describe("지역 범위", () => {
  it.each([
    ["전국", [{ kind: "nation" }]],
    ["전국(지역산업위기지역", [{ kind: "nation" }]],
    ["울산 남구", [{ kind: "area", 시도: "울산", 시군구: "남구" }]],
    ["광주광역시(5개 자치구)", [{ kind: "area", 시도: "광주", 시군구: "" }]],
    ["서울·경기", [{ kind: "area", 시도: "서울", 시군구: "" }, { kind: "area", 시도: "경기", 시군구: "" }]],
    ["울산광역시/울산신용보증재단", [{ kind: "area", 시도: "울산", 시군구: "" }]],
    ["경기 화성시, 경기", [{ kind: "area", 시도: "경기", 시군구: "" }]],
    ["확인안됨", []],
    ["", []],
  ])("%s", (t, out) => expect(parseScopes(t)).toEqual(out));
  it("시·군을 떼고 쓴 이름(여수·서산)", () => {
    expect(parseScopes("여수·서산")).toEqual([{ kind: "area", 시도: "전남", 시군구: "여수시" }, { kind: "area", 시도: "충남", 시군구: "서산시" }]);
  });
});

describe("마감", () => {
  it.each([
    ["2026-10-31", { kind: "date", date: "2026-10-31", budget: false }],
    ["2026-11-13 18:00(예산 소진 시 조기마감)", { kind: "date", date: "2026-11-13", budget: true }],
    ["2026.9.5", { kind: "date", date: "2026-09-05", budget: false }],
    ["예산 소진 시까지", { kind: "budget" }],
    ["상시 접수", { kind: "always" }],
    ["확인안됨", { kind: "unknown" }],
  ])("%s", (t, out) => expect(parseDeadline(t)).toEqual(out));
});

describe("공고 id·합치기", () => {
  it("기업마당 링크면 pblancId, 아니면 사업명+기관", () => {
    expect(announcementId(row({ 공고원문링크: "https://www.bizinfo.go.kr/x.do?pblancId=PBLN_0001" }))).toBe("PBLN_0001");
    expect(announcementId(row({}))).toBe("t:가상 정책자금|가상재단");
  });
  it("★같은 공고는 하나 — 최근 줄 내용, 처음 본 날 유지 · 빈 사업명 버림", () => {
    const days = [
      PolicyNewsDay.parse({ schema: 1, date: "2026-10-22", rows: [row({ 마감일: "2026-10-31" }), row({ 사업명: "" })] }),
      PolicyNewsDay.parse({ schema: 1, date: "2026-10-23", rows: [row({ 마감일: "2026-11-30", 지역: "울산 남구" }), row({ 사업명: "다른 공고" })] }),
    ];
    const list = mergeAnnouncements(days);
    expect(list).toHaveLength(2);
    const a = list.find((x) => x.title === "가상 정책자금")!;
    expect(a).toMatchObject({ firstSeen: "2026-10-22", lastSeen: "2026-10-23", deadlineText: "2026-11-30", regions: [{ kind: "area", 시도: "울산", 시군구: "남구" }] });
    expect(isClosed(a, "2026-12-01")).toBe(true);
    expect(isClosed(a, "2026-11-30")).toBe(false);
  });
  it("모르는 칸·빠진 칸에도 깨지지 않는다(계약 schema 1)", () => {
    const d = PolicyNewsDay.parse({ schema: 1, date: "2026-10-23", rows: [{ 사업명: "칸이 적은 공고", 새칸: "x" }] });
    expect(mergeAnnouncements([d])[0]).toMatchObject({ title: "칸이 적은 공고", regions: [], target: "", deadline: { kind: "unknown" } });
    expect(() => PolicyNewsDay.parse({ schema: 2, date: "2026-10-23", rows: [] })).toThrow();
  });
});
