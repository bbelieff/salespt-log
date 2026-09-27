/**
 * 실무수납 정렬·진행도 헬퍼 (payment-sort §P8).
 */
import { describe, it, expect } from "vitest";
import { ContractPayment } from "@/types";
import {
  contractProgress,
  progressPct,
} from "@/app/(app)/payment/_lib/payment-progress";

function cp(opts: {
  계약일?: string;
  row?: number;
  slots?: Array<{ 진행률?: string; 승인금액?: number }>;
}) {
  const s = opts.slots ?? [];
  return ContractPayment.parse({
    row: opts.row,
    계약일: opts.계약일 ?? "",
    수납1: s[0] ?? {},
    수납2: s[1] ?? {},
    수납3: s[2] ?? {},
  });
}

describe("progressPct", () => {
  it("문자열 진행률 → 숫자", () => {
    expect(progressPct("80%")).toBe(80);
    expect(progressPct("0%")).toBe(0);
    expect(progressPct("")).toBe(0);
  });
});

describe("contractProgress (보이는 슬롯 진행률 평균)", () => {
  it("슬롯1만 데이터 → 그 진행률", () => {
    expect(contractProgress(cp({ slots: [{ 진행률: "40%" }] }))).toBe(40);
  });
  it("슬롯2까지 데이터 → 2개 평균", () => {
    const c = cp({ slots: [{ 진행률: "100%" }, { 진행률: "40%", 승인금액: 1 }] });
    expect(contractProgress(c)).toBe(70);
  });
  it("데이터 없음 → 0", () => {
    expect(contractProgress(cp({}))).toBe(0);
  });
});
