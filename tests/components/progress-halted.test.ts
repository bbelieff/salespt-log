/**
 * 진행률 「중도중지」(2026-10-23 belie) — 수납 없이 끝난 진행건.
 *  ① 옛 진행률 값과 새 값 모두 통과(하위 호환)
 *  ② 오늘 챙길 일(할 일·멈춘 업체)에서 빠진다
 *  ③ 업무 현황에서 진행 중으로 세지 않는다
 *  ④ 시트 미러에는 빈 칸으로 쓴다(시트 dropdown 에 없는 값)
 */
import { describe, expect, it } from "vitest";
import { PaymentSlot, Progress } from "@/types";
import { isHaltedSlot, progressPct, slotHasData } from "@/lib/analytics/contract-slots";
import { buildWorkStatusItems, isSlotClosed } from "@/lib/analytics/payment-work-status";
import { buildStalledWork, buildTodoFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import { cpToRow, rowToCP } from "@/repo/contract-payment-row";
import { TODAY, contract, slot, todo } from "./follow-ups-factories";

describe("진행률 중도중지", () => {
  it("옛 값은 그대로, 중도중지도 통과 — 모르는 값은 여전히 거부", () => {
    for (const v of ["", "0%", "20%", "100%", "중도중지"]) expect(Progress.parse(v)).toBe(v);
    expect(Progress.safeParse("50%").success).toBe(false);
    expect(PaymentSlot.parse({ 진행률: "80%" }).진행률).toBe("80%");
    expect(PaymentSlot.parse({}).진행률).toBe("");
  });

  it("중도중지는 0%로 계산하지만 칸은 '적힌 것'으로 본다", () => {
    const halted = slot({ 진행률: "중도중지" });
    expect(isHaltedSlot(halted)).toBe(true);
    expect(isHaltedSlot(slot({ 진행률: "100%" }))).toBe(false);
    expect(progressPct("중도중지")).toBe(0);
    expect(slotHasData(halted)).toBe(true);
    expect(isSlotClosed(halted, TODAY)).toBe(true);
    expect(isSlotClosed(slot({ 진행기관: "기관A" }), TODAY)).toBe(false);
  });

  it("오늘 챙길 일: 중도중지 진행건의 할 일과 멈춤은 세지 않는다", () => {
    const cp = contract({ 수납1: slot({ 진행기관: "기관A", 진행률: "중도중지" }), 수납2: slot({ 진행기관: "기관B" }) });
    const todos = [todo({ id: "a", institutionRef: "기관A", slot: 1 }), todo({ id: "b", institutionRef: "기관B", slot: 2 })];
    expect(buildTodoFollowUps(todos, [cp], TODAY).today.map((i) => i.key)).toEqual(["todo:b"]);
    expect(buildStalledWork([cp], [], TODAY).map((i) => i.slot)).toEqual([2]);
    // 진행건 하나뿐인데 중도중지면 계약 전체가 빠진다.
    const only = contract({ 수납1: slot({ 진행기관: "기관A", 진행률: "중도중지" }) });
    expect(buildTodoFollowUps([todo({ institutionRef: "기관A" })], [only], TODAY).today).toEqual([]);
    expect(buildStalledWork([only], [], TODAY)).toEqual([]);
  });

  it("업무 현황: 중도중지 진행건은 빠지고, 전부 중도중지면 그 계약도 빠진다", () => {
    const mixed = contract({ 수납1: slot({ 진행기관: "기관A", 진행률: "중도중지" }), 수납2: slot({ 진행기관: "기관B", 메모: "통화" }) });
    expect(buildWorkStatusItems([mixed], [], TODAY).map((i) => [i.slot, i.status])).toEqual([[2, "progress"]]);
    const allHalted = contract({ row: 4, 수납1: slot({ 진행기관: "기관A", 진행률: "중도중지" }) });
    expect(buildWorkStatusItems([allHalted], [], TODAY)).toEqual([]);
    // 아무것도 안 적힌 계약은 예전처럼 진행대기 1건.
    expect(buildWorkStatusItems([contract({ row: 5 })], [], TODAY)).toMatchObject([{ status: "waiting", slot: 1 }]);
  });

  it("시트 미러: 중도중지는 빈 칸으로 쓰고, 다른 진행률은 그대로", () => {
    const row = cpToRow(contract({ 수납1: slot({ 진행률: "중도중지" }), 수납2: slot({ 진행률: "60%" }) }));
    expect(row[13]).toBe("");
    expect(row[19]).toBe("60%");
    // DB 겹쳐 읽기가 넣은 값(중도중지)은 읽을 때 살아남는다.
    const back = [...row];
    back[13] = "중도중지";
    expect(rowToCP(back, 3)?.수납1.진행률).toBe("중도중지");
  });
});
