import { describe, it, expect } from "vitest";
import {
  sheetTitleMatchesTokens,
  pickSheetFromCandidates,
  filterSheetsByTokens,
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

describe("filterSheetsByTokens — 폴더 enumerate (전체 매칭)", () => {
  const T8 = ["세일즈PT", "8기", "경영일지"];

  it("8기 시트 여러 본 모두 반환 (id 순서 보존)", () => {
    const r = filterSheetsByTokens(
      [
        { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
        { id: "b", name: "세일즈PT_ 8기 김현민 경영일지" },
        { id: "c", name: "세일즈PT_ 8기 박상준 경영일지" },
      ],
      T8,
    );
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it('숫자 경계: "8기" 가 "18기" 시트를 제외', () => {
    const r = filterSheetsByTokens(
      [
        { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
        { id: "x", name: "세일즈PT_ 18기 홍길동 경영일지" },
      ],
      T8,
    );
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("토큰 불충족(다른 기수·비경영일지) 제외 + id 중복 제거", () => {
    const r = filterSheetsByTokens(
      [
        { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" },
        { id: "a", name: "세일즈PT_ 8기 김승엽 경영일지" }, // 중복 id
        { id: "y", name: "세일즈PT_ 7기 김영준 경영일지" }, // 7기
        { id: "z", name: "세일즈PT_ 8기 박상준 업체관리" }, // 경영일지 아님
      ],
      T8,
    );
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("매칭 0개 → 빈 배열", () => {
    expect(filterSheetsByTokens([{ id: "x", name: "무관 시트" }], T8)).toEqual([]);
  });
});
