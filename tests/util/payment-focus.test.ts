import { describe, expect, it } from "vitest";
import { parsePaymentSlotTarget } from "@/util/payment-focus";

describe("parsePaymentSlotTarget", () => {
  it("진행 회차 링크의 행과 회차를 읽는다", () => {
    expect(parsePaymentSlotTarget("?row=17&slot=2")).toEqual({ row: 17, slot: 2 });
  });

  it("잘못된 행·회차는 상세를 열지 않는다", () => {
    for (const search of ["", "?row=0&slot=1", "?row=1.5&slot=1", "?row=1&slot=4", "?row=abc&slot=1"]) {
      expect(parsePaymentSlotTarget(search)).toBeNull();
    }
  });
});
