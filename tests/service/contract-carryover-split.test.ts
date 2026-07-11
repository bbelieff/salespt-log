/**
 * arena-start-revenue-split — 시작일(courseStart) 기준 이월 판정 + 매출 2분할.
 * 경계는 개인 시트 O1(courseStart). "6/12" 류 하드코딩 없음(날짜 인자로 주입).
 */
import { describe, it, expect } from "vitest";
import { ContractPayment } from "@/types";
import { isCarryoverContract } from "@/service/contract-payment";
import { splitContractRevenue } from "@/service/dashboard";
import {
  CONTRACT_RECEIVED_FORMULAS,
  SALES_FEE_TOTAL_FORMULA,
} from "@/repo/contract-formulas";

const START = "2026-06-12"; // 가정 아레나 시작일 (시즌마다 다름 — 인자로 주입)

function cp(opts: {
  계약일?: string;
  구분?: string;
  수임비?: number;
  수납액?: [number?, number?, number?];
}) {
  const r = opts.수납액 ?? [];
  return ContractPayment.parse({
    계약일: opts.계약일 ?? "",
    구분: opts.구분 ?? "",
    수임비: opts.수임비 ?? 0,
    수납1: { 수납액: r[0] ?? 0 },
    수납2: { 수납액: r[1] ?? 0 },
    수납3: { 수납액: r[2] ?? 0 },
  });
}

describe("isCarryoverContract (단일 판정점 — 깃발 OR 계약일<시작일)", () => {
  it("구분=이월 깃발 → true (날짜 무관)", () => {
    expect(isCarryoverContract({ 구분: "이월", 계약일: "2026-07-01" }, START)).toBe(true);
  });
  it("계약일 < 시작일 → true (깃발 없어도)", () => {
    expect(isCarryoverContract({ 구분: "", 계약일: "2026-06-11" }, START)).toBe(true);
  });
  it("계약일 = 시작일 → false (이상은 아레나 집계)", () => {
    expect(isCarryoverContract({ 계약일: "2026-06-12" }, START)).toBe(false);
  });
  it("계약일 > 시작일 → false", () => {
    expect(isCarryoverContract({ 계약일: "2026-06-20" }, START)).toBe(false);
  });
  it("계약일 비ISO/빈값 → 깃발만으로 판정(오분류 방지)", () => {
    expect(isCarryoverContract({ 계약일: "" }, START)).toBe(false);
    expect(isCarryoverContract({ 계약일: "45810" }, START)).toBe(false); // 직렬 → 비교 안 함
    expect(isCarryoverContract({ 구분: "이월", 계약일: "" }, START)).toBe(true);
  });
  it("시작일 빈값 → 깃발만(경계 불명 시 안전)", () => {
    expect(isCarryoverContract({ 계약일: "2026-01-01" }, "")).toBe(false);
  });
});

describe("splitContractRevenue (아레나/이월/전체 분리)", () => {
  it("깃발·날짜 혼합 → 각 버킷 합산 + 전체=합", () => {
    const payments = [
      cp({ 계약일: "2026-06-20", 수임비: 100, 수납액: [50] }), // 아레나 (시작 이후)
      cp({ 계약일: "2026-06-01", 수임비: 200, 수납액: [30] }), // 이월 (시작 이전)
      cp({ 계약일: "2026-07-01", 구분: "이월", 수임비: 10, 수납액: [5] }), // 이월 (깃발)
    ];
    const { arena, carryover, total } = splitContractRevenue(payments, START);
    expect(arena).toEqual({ totalFee: 100, totalReceived: 50, totalRefunded: 0, revenue: 150 });
    expect(carryover).toEqual({ totalFee: 210, totalReceived: 35, totalRefunded: 0, revenue: 245 });
    expect(total).toEqual({ totalFee: 310, totalReceived: 85, totalRefunded: 0, revenue: 395 });
  });
  it("전부 아레나면 carryover=0", () => {
    const { arena, carryover } = splitContractRevenue(
      [cp({ 계약일: "2026-06-15", 수임비: 100 })],
      START,
    );
    expect(arena.revenue).toBe(100);
    expect(carryover.revenue).toBe(0);
  });
  it("3슬롯 수납액 모두 합산", () => {
    const { arena } = splitContractRevenue(
      [cp({ 계약일: "2026-06-20", 수임비: 0, 수납액: [10, 20, 30] })],
      START,
    );
    expect(arena.totalReceived).toBe(60);
  });
  it("승인금액은 매출에 미반영 — 승인>0·수납액=0 이면 매출=수임비만 (ADR-0026)", () => {
    const p = ContractPayment.parse({
      계약일: "2026-06-20",
      수임비: 100,
      수납1: { 승인금액: 5000, 수납액: 0 }, // 승인만, 미수령
      수납2: { 승인금액: 3000, 수납액: 0 },
    });
    const { arena } = splitContractRevenue([p], START);
    expect(arena.totalReceived).toBe(0); // 승인 8000 은 매출 아님
    expect(arena.revenue).toBe(100); // = 수임비, 승인 제외
  });
  it("수납액이 들어오면 그만큼만 매출 증가 (승인과 무관)", () => {
    const p = ContractPayment.parse({
      계약일: "2026-06-20",
      수임비: 100,
      수납1: { 승인금액: 5000, 수납액: 2000 }, // 승인 5000 중 2000 수령
    });
    const { arena } = splitContractRevenue([p], START);
    expect(arena.revenue).toBe(2100); // 수임비 100 + 수납 2000 (승인 5000 무시)
  });
});

describe("SALES_FEE_TOTAL_FORMULA (영업관리 O5 = 수수료총합)", () => {
  it("02!D3(수납총액)만 참조 — 승인총액 D2 절대 미포함 (ADR-0026)", () => {
    expect(SALES_FEE_TOTAL_FORMULA).toContain("'02 계약수납관리'!D3");
    expect(SALES_FEE_TOTAL_FORMULA).not.toContain("D2");
  });
  it("매출 합산식(O5·D3·D4) 어디에도 D2(승인총액) 가 없다", () => {
    for (const f of [
      SALES_FEE_TOTAL_FORMULA,
      CONTRACT_RECEIVED_FORMULAS.arena,
      CONTRACT_RECEIVED_FORMULAS.carryover,
    ]) {
      expect(f).not.toContain("D2");
    }
  });
});

describe("CONTRACT_RECEIVED_FORMULAS (시트 D3 아레나 / D4 이월)", () => {
  it("아레나 = 구분<>이월, 이월 = 구분=이월 (Q/W/AC 3슬롯)", () => {
    expect(CONTRACT_RECEIVED_FORMULAS.arena).toContain('$AI$6:$AI,"<>이월"');
    expect(CONTRACT_RECEIVED_FORMULAS.arena).not.toContain('$AI$6:$AI,"이월"');
    expect(CONTRACT_RECEIVED_FORMULAS.carryover).toContain('$AI$6:$AI,"이월"');
    expect(CONTRACT_RECEIVED_FORMULAS.carryover).not.toContain("<>이월");
    // 두 수식 모두 3슬롯(Q/W/AC) 합산.
    for (const f of [CONTRACT_RECEIVED_FORMULAS.arena, CONTRACT_RECEIVED_FORMULAS.carryover]) {
      expect(f).toContain("Q6:Q");
      expect(f).toContain("W6:W");
      expect(f).toContain("AC6:AC");
    }
  });
});
