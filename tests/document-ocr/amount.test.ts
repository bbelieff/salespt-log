/**
 * 문서 파서 공용 금액 표기 — 새 금액 칸은 formatManwon 한 가지, 기존 매출 칸은 formatBaekman.
 */
import { describe, expect, it } from "vitest";
import { formatBaekman, formatManwon, groupThousands } from "@/lib/document-ocr/amount";

describe("formatManwon", () => {
  it("만 단위 반올림 · 쉼표 · 음수", () => {
    expect(formatManwon(10_000_000)).toBe("1,000만");
    expect(formatManwon(500_000)).toBe("50만");
    expect(formatManwon(32_000_000)).toBe("3,200만");
    expect(formatManwon(32_004_999)).toBe("3,200만");
    expect(formatManwon(-32_000_000)).toBe("-3,200만");
    expect(formatManwon(5_000)).toBe("5,000원");
    expect(formatManwon(0)).toBe("0원");
  });
  it("1억 이상 — 천만 단위로 떨어지면 소수, 아니면 만 단위까지(반올림으로 금액이 바뀌지 않게)", () => {
    expect(formatManwon(120_000_000)).toBe("1.2억");
    expect(formatManwon(300_000_000)).toBe("3억");
    expect(formatManwon(125_000_000)).toBe("1억 2,500만");
    expect(formatManwon(1_234_000_000)).toBe("12억 3,400만");
    expect(formatManwon(2_500_000_000)).toBe("25억");
    expect(formatManwon(-240_000_000)).toBe("-2.4억");
    expect(formatManwon(99_995_000)).toBe("1억");
  });
  it("sep=false — 소유여부 문구용", () => {
    expect(formatManwon(10_000_000, { sep: false })).toBe("1000만");
    expect(formatManwon(1_255_000_000, { sep: false })).toBe("12억 5500만");
  });
});

describe("formatBaekman · groupThousands", () => {
  it("기존 매출 칸 표기", () => {
    expect(formatBaekman(250_400_000)).toBe("250백만");
    expect(formatBaekman(3_200_000_000)).toBe("3,200백만");
    expect(formatBaekman(300_000)).toBe("0.3백만");
    expect(formatBaekman(0)).toBe("0백만");
    expect(formatBaekman(-1_234_000_000)).toBe("-1,234백만");
    expect(groupThousands(-1234567)).toBe("-1,234,567");
  });
});
