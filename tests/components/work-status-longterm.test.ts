/**
 * 전체 진행건 막대의 「장기관리」 칸(2026-10-24 belie) — 대시보드·실무/수납이 같은 buildWorkStatusItems 를 쓴다.
 *  · 조건 대기·장기관리 진행건 → 장기관리(수납액이 있어도)
 *  · 직접 「장기관리」로 보낸 업체 → 수납완료가 아닌 진행건은 장기관리, 수납완료는 그대로
 *  · 조건 대기·단기관리는 지금처럼 진행 중
 */
import { describe, expect, it } from "vitest";
import { buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import { TODAY, contract, slot } from "./follow-ups-factories";

const statuses = (cp: Parameters<typeof contract>[0]) => buildWorkStatusItems([contract(cp)], [], TODAY).map((i) => i.status);

describe("전체 진행건 — 장기관리", () => {
  it("★조건 대기·장기관리 진행건은 장기관리 칸", () => {
    expect(statuses({ 수납1: slot({ 진행기관: "기관A", 진행률: "조건 대기", 대기기간: "장기" }) })).toEqual(["longterm"]);
    expect(statuses({ 수납1: slot({ 진행기관: "기관A", 진행률: "조건 대기", 대기기간: "장기", 수납액: 100 }) })).toEqual(["longterm"]);
  });
  it("조건 대기·단기관리는 진행 중으로 남는다", () => {
    expect(statuses({ 수납1: slot({ 진행기관: "기관A", 진행률: "조건 대기", 대기기간: "단기" }) })).toEqual(["progress"]);
  });
  it("★직접 장기관리로 보낸 업체: 끝나지 않은 진행건은 장기관리, 수납완료는 수납완료", () => {
    expect(statuses({
      관리상태: "장기관리", 관리상태진행건: [1],
      수납1: slot({ 진행기관: "기관A", 진행상품: "운전자금" }),
      수납2: slot({ 진행기관: "기관B", 수납액: 300 }),
    })).toEqual(["longterm", "collected"]);
  });
  it("장기관리가 아닌 업체는 그대로", () => {
    expect(statuses({ 수납1: slot({ 진행기관: "기관A", 진행상품: "운전자금" }) })).toEqual(["progress"]);
  });
});
