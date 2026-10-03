/**
 * 2026-09-19 — 공백 하나로 ToDo 가 탭에서 사라지던 것.
 *
 * 실제 사고: 슬롯 진행기관이 「신용보증기금 」(끝 공백 1개), ToDo 는 「신용보증기금」.
 * 실무(수납) 탭은 `t.institutionRef === savedInstitution` 로 걸러서 그 ToDo 가 안 보였고,
 * 캘린더는 날짜로만 보니 계속 보였다 → 「캘린더엔 뜨는데 탭엔 안 뜬다」.
 *
 * 과하게 뭉개면 반대 사고가 난다 — 남의 슬롯 ToDo 가 붙는다. 그래서 **양끝 공백만** 무시한다.
 */
import { describe, expect, it } from "vitest";
import { normalizeInstitution, sameInstitution } from "@/util/institution-match";

describe("★신고 케이스 — 눈에 안 보이는 공백", () => {
  it("끝 공백 하나는 같은 기관으로 본다", () => {
    expect(sameInstitution("신용보증기금", "신용보증기금 ")).toBe(true);
  });

  it("앞 공백도 마찬가지", () => {
    expect(sameInstitution(" 전북재단 부안지점", "전북재단 부안지점")).toBe(true);
  });

  it("양쪽 다 공백이 있어도 같다", () => {
    expect(sameInstitution("  신용보증기금  ", " 신용보증기금")).toBe(true);
  });
});

describe("★다른 기관은 계속 달라야 한다 — 과하게 뭉개지 않는다", () => {
  it("지점이 다르면 다른 기관", () => {
    expect(sameInstitution("전북재단 김제지점", "전북재단 부안지점")).toBe(false);
  });

  it("안쪽 공백 수가 다르면 건드리지 않는다 — 자유입력이라 실제로 다를 수 있다", () => {
    expect(sameInstitution("전북재단  김제지점", "전북재단 김제지점")).toBe(false);
  });

  it("메모가 섞이면 다른 값이다 — 이건 데이터 정정이 필요한 건", () => {
    // 실제 사례: ToDo 기관 칸에 「8.31 신용보증재단 신청」이 들어갔다.
    expect(sameInstitution("8.31 신용보증재단 신청", "신용보증재단")).toBe(false);
  });
});

describe("빈값 처리", () => {
  it("빈값·null·undefined 는 모두 같은 것으로 본다", () => {
    expect(sameInstitution("", null)).toBe(true);
    expect(sameInstitution(undefined, "")).toBe(true);
    expect(sameInstitution("   ", "")).toBe(true);
  });

  it("빈값과 실제 기관은 다르다 — 기관 미지정 ToDo 가 아무 슬롯에나 붙으면 안 된다", () => {
    expect(sameInstitution("", "신용보증기금")).toBe(false);
  });

  it("normalize 는 양끝만 턴다", () => {
    expect(normalizeInstitution("  가 나  ")).toBe("가 나");
    expect(normalizeInstitution(null)).toBe("");
  });
});
