/** 입력 동시 서식 — 쉼표·사업자번호 대시와 커서 위치(belie 2026-09-29). */
import { describe, expect, it } from "vitest";
import { bizNoTyping, groupTyping } from "@/util/live-format";

describe("groupTyping — 입력하는 동시에 천 단위 쉼표", () => {
  it("치는 대로 쉼표가 붙고 커서는 친 숫자 뒤", () => {
    expect(groupTyping("1234", 4)).toEqual({ value: "1,234", caret: 5 });
    expect(groupTyping("1,2345", 6)).toEqual({ value: "12,345", caret: 6 });
    expect(groupTyping("123456.7", 8)).toEqual({ value: "123,456.7", caret: 9 });
  });
  it("가운데에 숫자를 넣어도 커서가 그 숫자 뒤에 남는다", () => {
    // "1,234" 의 "1" 뒤에 9 입력 → "19,234"(커서는 9 뒤)
    expect(groupTyping("19,234", 2, "1,234")).toEqual({ value: "19,234", caret: 2 });
  });
  it("쉼표만 지우면(Backspace) 그 앞 숫자를 지운다", () => {
    // "1,234" 에서 커서가 쉼표 뒤(2)일 때 Backspace → 브라우저 값 "1234"(caret 1)
    expect(groupTyping("1234", 1, "1,234")).toEqual({ value: "234", caret: 0 });
  });
  it("손익 칸은 앞 '-' 유지, 다른 칸은 버린다", () => {
    expect(groupTyping("-1234", 5, "", true)).toEqual({ value: "-1,234", caret: 6 });
    expect(groupTyping("-1234", 5)).toEqual({ value: "1,234", caret: 5 });
  });
  it("글로 적힌 옛 값은 손대지 않는다", () => {
    expect(groupTyping("3,200만", 6)).toBeNull();
  });
});

describe("bizNoTyping — 사업자등록번호 000-00-00000", () => {
  it("치는 대로 대시가 들어간다", () => {
    expect(bizNoTyping("123", 3)).toEqual({ value: "123", caret: 3 });
    expect(bizNoTyping("1234", 4)).toEqual({ value: "123-4", caret: 5 });
    expect(bizNoTyping("123-456", 7)).toEqual({ value: "123-45-6", caret: 8 });
    expect(bizNoTyping("1234567890", 10)).toEqual({ value: "123-45-67890", caret: 12 });
  });
  it("10자리 넘는 숫자는 버리고, 붙여 넣은 대시 번호는 그대로 정리", () => {
    expect(bizNoTyping("123-45-678901", 13)).toEqual({ value: "123-45-67890", caret: 12 });
  });
  it("대시만 지우면 그 앞 숫자를 지운다", () => {
    // "123-45" 에서 커서가 대시 뒤(4) → Backspace → "12345"(caret 3)
    expect(bizNoTyping("12345", 3, "123-45")).toEqual({ value: "124-5", caret: 2 });
  });
  it("숫자 아닌 글자가 있으면 손대지 않는다", () => {
    expect(bizNoTyping("가나다", 3)).toBeNull();
  });
});
