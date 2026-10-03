/**
 * 조사 선택 — 화면 문구에 변수로 들어오는 말의 조사가 틀어지던 것(2026-09-19).
 * 실제 사례: 「게시을 입력하세요」(→ 게시를), 「영업기회이 추가됐어요」(→ 영업기회가).
 */
import { describe, expect, it } from "vitest";
import { eulReul, eunNeun, hasFinalConsonant, iGa } from "@/util/josa";

describe("받침 판정", () => {
  it("받침 있는 말", () => {
    // 미팅예약 = 「약」에 ㄱ 받침. 눈으로 세면 틀리기 쉬워 여기 박아 둔다.
    for (const w of ["유입", "구매목록", "생산목록", "제작목록", "현수막", "미팅예약", "컨택진행"]) {
      expect(hasFinalConsonant(w)).toBe(true);
    }
  });

  it("받침 없는 말", () => {
    for (const w of ["게시", "영업기회", "가", "나", "대시보드"]) {
      expect(hasFinalConsonant(w)).toBe(false);
    }
  });

  it("한글이 아닌 끝 글자는 받침 있음으로 본다(보수적)", () => {
    expect(hasFinalConsonant("DB")).toBe(true);
    expect(hasFinalConsonant("3")).toBe(true);
  });

  it("빈 문자열·공백도 죽지 않는다", () => {
    expect(hasFinalConsonant("")).toBe(true);
    expect(hasFinalConsonant("   ")).toBe(true);
    expect(() => eulReul("")).not.toThrow();
  });
});

describe("실제 화면 문구", () => {
  it("★게시를 / 유입을 — 이게 틀려서 고쳤다", () => {
    expect(`게시${eulReul("게시")}`).toBe("게시를");
    expect(`유입${eulReul("유입")}`).toBe("유입을");
  });

  it("★영업기회가 / 구매목록이 — 이것도 틀렸었다", () => {
    expect(`영업기회${iGa("영업기회")}`).toBe("영업기회가");
    expect(`구매목록${iGa("구매목록")}`).toBe("구매목록이");
    expect(`제작목록${iGa("제작목록")}`).toBe("제작목록이");
    expect(`생산목록${iGa("생산목록")}`).toBe("생산목록이");
  });

  it("은/는", () => {
    expect(`현수막${eunNeun("현수막")}`).toBe("현수막은");
    expect(`영업기회${eunNeun("영업기회")}`).toBe("영업기회는");
  });
});
