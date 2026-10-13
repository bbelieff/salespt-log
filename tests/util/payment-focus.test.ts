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

import { parsePaymentRowTarget, paymentFocusedSlot } from "@/util/payment-focus";
describe("company-only and explicit-slot entry",()=>{
 it("accepts row-only without weakening the strict slot parser",()=>{
  expect(parsePaymentRowTarget("?row=17&focus=todo")).toEqual({row:17,slot:null});
  expect(parsePaymentSlotTarget("?row=17&focus=todo")).toBeNull();
  expect(parsePaymentRowTarget("?row=17&slot=2")).toEqual({row:17,slot:2});
  for(const search of ["?row=17&slot=4","?row=17&slot=","?row=0","?row=1.5"]){expect(parsePaymentRowTarget(search)).toBeNull();}
 });
 it("explicit target beats representative slot; company-only remains unset and clearing restores user selection",()=>{
  expect(paymentFocusedSlot({row:17,slot:2},17,1)).toBe(2);
  expect(paymentFocusedSlot({row:17,slot:null},17,1)).toBeNull();
  expect(paymentFocusedSlot({row:17,slot:2},3,1)).toBe(1);
  expect(paymentFocusedSlot(null,17,1)).toBe(1);
 });
});
