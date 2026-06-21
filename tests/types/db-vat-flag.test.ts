/**
 * DBPurchase·DBBanner 부가세여부 (C3 보강 — 매입DB H · 현수막 W).
 * 기존 행(H/W 빈칸) 안전 기본값 false + 명시 true 보존.
 */
import { describe, it, expect } from "vitest";
import { DBPurchase, DBBanner } from "@/types";

describe("부가세여부 boolean 필드", () => {
  it("DBPurchase: 누락 시 false (기존 행 lazy backfill)", () => {
    const p = DBPurchase.parse({ 구매일: "2026-06-21", 개당단가: 1000, 주문개수: 10 });
    expect(p.부가세여부).toBe(false);
  });
  it("DBPurchase: 명시 true 보존", () => {
    const p = DBPurchase.parse({ 구매일: "2026-06-21", 부가세여부: true });
    expect(p.부가세여부).toBe(true);
  });
  it("DBBanner: 누락 시 false", () => {
    const b = DBBanner.parse({ 날짜: "2026-06-21", 개당단가: 5000, 주문개수: 2 });
    expect(b.부가세여부).toBe(false);
  });
  it("DBBanner: 명시 true 보존", () => {
    const b = DBBanner.parse({ 날짜: "2026-06-21", 부가세여부: true });
    expect(b.부가세여부).toBe(true);
  });
});
