/**
 * 실무수납 정렬·진행도 헬퍼 (payment-sort §P8).
 */
import { describe, it, expect } from "vitest";
import { ContractPayment } from "@/types";
import {
  contractProgress,
  sortContracts,
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

describe("sortContracts", () => {
  const rows = [
    cp({ row: 6, 계약일: "2026-06-10", slots: [{ 진행률: "40%" }] }),
    cp({ row: 7, 계약일: "2026-06-05", slots: [{ 진행률: "80%" }] }),
    cp({ row: 8, 계약일: "", slots: [{ 진행률: "20%" }] }), // 빈 계약일
  ];
  it("date-asc: 빠른 날짜 먼저, 빈값 끝", () => {
    const r = sortContracts(rows, "date-asc");
    expect(r.map((x) => x.row)).toEqual([7, 6, 8]);
  });
  it("date-desc: 늦은 날짜 먼저, 빈값 끝", () => {
    const r = sortContracts(rows, "date-desc");
    expect(r.map((x) => x.row)).toEqual([6, 7, 8]);
  });
  it("progress-asc: 진행 낮은순", () => {
    const r = sortContracts(rows, "progress-asc");
    expect(r.map((x) => x.row)).toEqual([8, 6, 7]); // 20,40,80
  });
  it("progress-desc: 진행 높은순", () => {
    const r = sortContracts(rows, "progress-desc");
    expect(r.map((x) => x.row)).toEqual([7, 6, 8]); // 80,40,20
  });
  it("원본 불변", () => {
    const before = rows.map((x) => x.row);
    sortContracts(rows, "date-asc");
    expect(rows.map((x) => x.row)).toEqual(before);
  });
});
