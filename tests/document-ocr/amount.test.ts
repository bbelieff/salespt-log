/**
 * 문서 파서 공용 원 금액 표기 — groupThousands(임차 원 금액·비교표 원문).
 * [재무] 금액 칸의 백만원 표기는 tests/util/company-money.test.ts.
 */
import { describe, expect, it } from "vitest";
import { groupThousands } from "@/lib/document-ocr/amount";

describe("groupThousands", () => {
  it("천 단위 쉼표, 부호 유지, 소수 버림", () => {
    expect(groupThousands(-1234567)).toBe("-1,234,567");
    expect(groupThousands(250_123_456)).toBe("250,123,456");
    expect(groupThousands(999)).toBe("999");
    expect(groupThousands(1234.9)).toBe("1,234");
  });
});
