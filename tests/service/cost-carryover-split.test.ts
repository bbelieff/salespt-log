/**
 * BBE-83 — 시작일(courseStart) 기준 비용 이월 분할. splitContractRevenue 와 대칭
 * (단일 결정점: date < courseStartISO). belie 결정 2026-08-07: "8/7이전 비용 이월시켜줘".
 */
import { describe, it, expect } from "vitest";
import {
  splitDbCost,
  purchasesToDatedCost,
  productionsToDatedCost,
  bannersToDatedCost,
} from "@/service/dashboard-cost-carryover";
import type { DBPurchase, DBProduction, DBBanner } from "@/types";

const START = "2026-08-07"; // 가정 개강일 (시즌마다 다름 — 인자로 주입)

describe("splitDbCost — 단일 결정점(date < courseStartISO)", () => {
  it("이전 날짜만 이월, 이후는 시즌", () => {
    const r = splitDbCost(
      [
        { date: "2026-08-06", amount: 1_000 }, // 이전 → 이월
        { date: "2026-08-07", amount: 2_000 }, // 당일 → 시즌(이상 포함, 매출과 동일 규칙)
        { date: "2026-08-08", amount: 3_000 }, // 이후 → 시즌
      ],
      START,
    );
    expect(r).toEqual({ season: 5_000, carryover: 1_000, total: 6_000 });
  });

  it("날짜 비ISO/빈값 → 시즌으로 귀속(오분류 방지, isCarryoverContract 와 동일 규칙)", () => {
    const r = splitDbCost(
      [
        { date: "", amount: 100 },
        { date: "45810", amount: 200 }, // 직렬 문자열 → 비교 안 함
        { date: "2026-8-7", amount: 300 }, // 자리수 안 맞음(패딩 없음) → 비ISO
      ],
      START,
    );
    expect(r).toEqual({ season: 600, carryover: 0, total: 600 });
  });

  it("courseStartISO 빈값 → 경계 불명, 전부 시즌(안전)", () => {
    const r = splitDbCost([{ date: "2026-01-01", amount: 500 }], "");
    expect(r).toEqual({ season: 500, carryover: 0, total: 500 });
  });

  it("빈 목록 → 전부 0", () => {
    expect(splitDbCost([], START)).toEqual({ season: 0, carryover: 0, total: 0 });
  });
});

describe("매입DB/직접생산/현수막 → DatedCostRow 변환", () => {
  it("purchasesToDatedCost — 구매일 기준", () => {
    const rows: DBPurchase[] = [
      DBPurchaseFixture({ 구매일: "2026-06-01", 주문금액: 900_104 }),
    ];
    expect(purchasesToDatedCost(rows)).toEqual([{ date: "2026-06-01", amount: 900_104 }]);
  });

  it("productionsToDatedCost — 시작일 기준(ADR-0022 §3: 비용은 시작 시 반영, 완료집계=종료일과 별개)", () => {
    const withEnd: DBProduction[] = [
      DBProductionFixture({ 시작일: "2026-06-01", 종료일: "2026-06-10", 기간예산: 500_000 }),
    ];
    expect(productionsToDatedCost(withEnd)).toEqual([{ date: "2026-06-01", amount: 500_000 }]);

    const ongoing: DBProduction[] = [
      DBProductionFixture({ 시작일: "2026-06-01", 종료일: "", 기간예산: 100_000 }),
    ];
    expect(productionsToDatedCost(ongoing)).toEqual([{ date: "2026-06-01", amount: 100_000 }]);
  });

  it("splitDbCost + productionsToDatedCost — 개강 전 시작·개강 후 완료 경계교차 건은 이월(시작일 기준)", () => {
    const boundaryCrossing: DBProduction[] = [
      DBProductionFixture({ 시작일: "2026-08-01", 종료일: "2026-08-12", 기간예산: 300_000 }),
    ];
    const rows = productionsToDatedCost(boundaryCrossing);
    expect(rows).toEqual([{ date: "2026-08-01", amount: 300_000 }]);
    expect(splitDbCost(rows, START)).toEqual({ season: 0, carryover: 300_000, total: 300_000 });
  });

  it("bannersToDatedCost — 날짜(주문일) 기준, 도착일 아님", () => {
    const rows: DBBanner[] = [
      DBBannerFixture({ 날짜: "2026-06-15", 도착일: "2026-06-20", 주문금액: 50_000 }),
    ];
    expect(bannersToDatedCost(rows)).toEqual([{ date: "2026-06-15", amount: 50_000 }]);
  });
});

function DBPurchaseFixture(over: Partial<DBPurchase>): DBPurchase {
  return { 구매일: "", 업체명: "", 개당단가: 0, 주문개수: 0, 기타: "", 부가세여부: false, ...over };
}
function DBProductionFixture(over: Partial<DBProduction>): DBProduction {
  return { 시작일: "", 종료일: "", 소재: "", 기간예산: 0, 생산개수: 0, 기타: "", 부가세여부: false, ...over };
}
function DBBannerFixture(over: Partial<DBBanner>): DBBanner {
  return { 날짜: "", 업체명: "", 도착일: "", 개당단가: 0, 주문개수: 0, 기타: "", 부가세여부: false, ...over };
}
