import { describe, it, expect } from "vitest";
import {
  sheetTitleMatchesTokens,
  pickSheetFromCandidates,
} from "@/repo/sheet-title-match";

const TOKENS = ["세일즈PT", "8기", "김승엽", "경영일지"];

describe("sheetTitleMatchesTokens", () => {
  it('"수강생" 없는 8기 제목 매칭', () => {
    expect(
      sheetTitleMatchesTokens("세일즈PT_ 8기 김승엽 경영일지", TOKENS),
    ).toBe(true);
  });

  it('"수강생" 있는 7기 제목도 매칭', () => {
    expect(
      sheetTitleMatchesTokens(
        "세일즈PT_ 7기 김영준 수강생 경영일지",
        ["세일즈PT", "7기", "김영준", "경영일지"],
      ),
    ).toBe(true);
  });

  it("(new)/사본 suffix 흡수", () => {
    expect(
      sheetTitleMatchesTokens("세일즈PT_ 8기 김승엽 경영일지 (사본)", TOKENS),
    ).toBe(true);
  });

  it('숫자 경계: "8기" 가 "18기" 제목에 오매칭 안 됨', () => {
    expect(
      sheetTitleMatchesTokens("세일즈PT_ 18기 김승엽 경영일지", TOKENS),
    ).toBe(false);
  });

  it('숫자 경계: "8기" 가 정상적으로 "8기" 에는 매칭 (앞에 비숫자/시작)', () => {
    expect(sheetTitleMatchesTokens("8기 김승엽 세일즈PT 경영일지", TOKENS)).toBe(true);
  });

  it("토큰 하나라도 빠지면 불일치", () => {
    expect(
      sheetTitleMatchesTokens("세일즈PT_ 8기 김승엽 일지", TOKENS),
    ).toBe(false); // "경영일지" 없음
    expect(
      sheetTitleMatchesTokens("세일즈PT_ 8기 박영업 경영일지", TOKENS),
    ).toBe(false); // 이름 불일치
  });

  it("빈 토큰 → false", () => {
    expect(sheetTitleMatchesTokens("아무 제목", [])).toBe(false);
  });
});

describe("pickSheetFromCandidates", () => {
  it("0개 매칭 → null", () => {
    expect(
      pickSheetFromCandidates(
        [{ id: "a", name: "세일즈PT_ 18기 김승엽 경영일지" }],
        TOKENS,
      ),
    ).toBeNull();
  });

  it("정확히 1개 → id", () => {
    expect(
      pickSheetFromCandidates(
        [
          { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
          { id: "b", name: "세일즈PT_ 8기 다른사람 경영일지" },
        ],
        TOKENS,
      ),
    ).toBe("a");
  });

  it("동일 id 중복 제거 후 1개 → id", () => {
    expect(
      pickSheetFromCandidates(
        [
          { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
          { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
        ],
        TOKENS,
      ),
    ).toBe("a");
  });

  it("2개+ 모호 → null (오등록 방지)", () => {
    expect(
      pickSheetFromCandidates(
        [
          { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
          { id: "b", name: "세일즈PT_ 8기 김승엽 경영일지 (백업)" },
        ],
        TOKENS,
      ),
    ).toBeNull();
  });

  it('2개+ 중 "수강생" 포함형 1개면 우선', () => {
    expect(
      pickSheetFromCandidates(
        [
          { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
          { id: "b", name: "세일즈PT_ 8기 김승엽 수강생 경영일지" },
        ],
        TOKENS,
      ),
    ).toBe("b");
  });
});
