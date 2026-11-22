/** 「(변경)」 일정 변경 표시 떼기 — 계약에는 실제 업체명(2026-11-22 belie). */
import { describe, expect, it } from "vitest";
import { hasRescheduleMark, stripRescheduleMark } from "@/util/reschedule-mark";

describe("stripRescheduleMark", () => {
  it("앞의 (변경) 표시와 공백을 뗀다", () => {
    expect(stripRescheduleMark("(변경) 가온식품")).toBe("가온식품");
    expect(stripRescheduleMark("(변경)가온식품")).toBe("가온식품");
    expect(stripRescheduleMark("(변경) (변경) 가온식품")).toBe("가온식품");
  });
  it("표시가 없거나 이름 중간에 있으면 그대로", () => {
    expect(stripRescheduleMark(" 가온식품 ")).toBe("가온식품");
    expect(stripRescheduleMark("가온식품(변경)")).toBe("가온식품(변경)");
  });
  it("떼고 나서 비면 원래 이름을 둔다", () => {
    expect(stripRescheduleMark("(변경)")).toBe("(변경)");
  });
  it("hasRescheduleMark", () => {
    expect(hasRescheduleMark("(변경) 가온식품")).toBe(true);
    expect(hasRescheduleMark("가온식품")).toBe(false);
  });
});
