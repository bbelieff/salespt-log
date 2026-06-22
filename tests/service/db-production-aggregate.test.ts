/**
 * productionCountFor — 생산(E) DB집계 (PR1 / ADR-0020).
 * 매입DB/직접생산/현수막 = Σ개수, 콜·지·기·소 = 행수. 날짜 매칭.
 */
import { describe, it, expect } from "vitest";
import { productionCountFor } from "@/service/db";

describe("productionCountFor (채널×날짜 생산수)", () => {
  it("매입DB = Σ주문개수 by 구매일", () => {
    const rows = [
      { 구매일: "2026-06-12", 주문개수: 3 },
      { 구매일: "2026-06-12", 주문개수: 2 },
      { 구매일: "2026-06-13", 주문개수: 5 },
    ];
    expect(productionCountFor("매입DB", rows, "2026-06-12")).toBe(5);
    expect(productionCountFor("매입DB", rows, "2026-06-13")).toBe(5);
    expect(productionCountFor("매입DB", rows, "2026-06-14")).toBe(0);
  });
  it("직접생산 = Σ생산개수 by 종료일, 완료(생산개수>0)만", () => {
    const rows = [
      { 종료일: "2026-06-12", 생산개수: 4 }, // 완료
      { 종료일: "2026-06-12", 생산개수: 1 }, // 완료
      { 종료일: "2026-06-12", 생산개수: 0 }, // 생산중 → 제외
    ];
    expect(productionCountFor("직접생산", rows, "2026-06-12")).toBe(5);
  });
  it("현수막 = Σ주문개수 by 날짜", () => {
    const rows = [{ 날짜: "2026-06-12", 주문개수: 7 }];
    expect(productionCountFor("현수막", rows, "2026-06-12")).toBe(7);
  });
  it("콜·지·기·소 = 행수 by 접수일 (개수 필드 없음)", () => {
    const rows = [
      { 접수일: "2026-06-12" },
      { 접수일: "2026-06-12" },
      { 접수일: "2026-06-13" },
    ];
    expect(productionCountFor("콜·지·기·소", rows, "2026-06-12")).toBe(2);
  });
  it("빈 날짜 → 0", () => {
    expect(productionCountFor("매입DB", [{ 구매일: "2026-06-12", 주문개수: 3 }], "")).toBe(0);
  });
});
