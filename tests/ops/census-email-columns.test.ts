import { describe, expect, it } from "vitest";
import { censusBlocked, headerVerdict, inspectColumn } from "../../scripts/ops/census-email-columns.mjs";

describe("이메일 열 census: 헤더와 데이터 보존", () => {
  it.each([undefined, "", "  ", "이메일", " 이메일 "])("빈 칸과 이메일 헤더는 허용: %s", (value) => {
    expect(headerVerdict(value)).toBe("ok");
  });
  it("기존 다른 제목과 수식 헤더는 보류한다", () => {
    expect(headerVerdict("메모")).toBe("blocked");
    expect(headerVerdict('="이메일"')).toBe("blocked");
  });
  it("헤더를 제외한 실제 값 한 개도 보류한다", () => {
    const result = inspectColumn([["이메일"], [""], ["ceo@example.com"]]);
    expect(result).toEqual({ headerBlocked: false, filledCells: 1 });
    expect(censusBlocked([{ filledCells: result.filledCells, headerBlocked: 0 }], 0, 1)).toBe(true);
  });
  it("숫자 0, false, 수식도 기존 데이터다", () => {
    expect(inspectColumn([[""], [0], [false], ['=""']]).filledCells).toBe(3);
  });
  it("다른 헤더·읽기 오류·대상 0건도 성공으로 판정하지 않는다", () => {
    expect(censusBlocked([{ filledCells: 0, headerBlocked: 1 }], 0, 1)).toBe(true);
    expect(censusBlocked([], 1, 1)).toBe(true);
    expect(censusBlocked([], 0, 0)).toBe(true);
    expect(censusBlocked([{ filledCells: 0, headerBlocked: 0 }], 0, 1)).toBe(false);
  });
});
