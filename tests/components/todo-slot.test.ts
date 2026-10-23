/** 2026-10-23 — 기록은 진행건 번호로 연결. 같은 기관을 쓰는 진행 1·2 에 기록이 함께 붙던 문제. 합성값. */
import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot } from "@/types";
import { todoSlotOf } from "@/lib/analytics/todo-slot";
import { buildWorkStatusItems } from "@/lib/analytics/payment-work-status";
import { rowToTodo } from "@/repo/todos";

const empty: PaymentSlot = { 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" };
const cp = (a: string, b = "", c = "") => ({
  row: 6, 계약일: "2026-10-07", 업체명: "예시상사",
  수납1: { ...empty, 진행기관: a, 진행상품: a ? "운전" : "" }, 수납2: { ...empty, 진행기관: b, 진행상품: b ? "시설" : "" }, 수납3: { ...empty, 진행기관: c },
}) as unknown as ContractPayment;

describe("todoSlotOf", () => {
  it("번호가 있으면 그 진행건 하나에만", () => {
    expect(todoSlotOf(cp("소진공", "소진공"), { institutionRef: "소진공", slot: 2 })).toEqual({ slot: 2, ambiguous: false });
  });
  it("옛 기록: 기관이 한 진행건에만 맞으면 그 진행건", () => {
    expect(todoSlotOf(cp("소진공", "신보"), { institutionRef: "신보 " })).toEqual({ slot: 2, ambiguous: false });
  });
  it("옛 기록: 같은 기관 진행건이 여럿이면 첫 진행건에 한 번만 + 확인 필요", () => {
    expect(todoSlotOf(cp("소진공", "소진공"), { institutionRef: "소진공" })).toEqual({ slot: 1, ambiguous: true });
  });
  it("맞는 기관이 없으면 어디에도 안 붙음", () => {
    expect(todoSlotOf(cp("소진공"), { institutionRef: "기보" })).toEqual({ slot: null, ambiguous: false });
  });
});

describe("업무 현황 — 기록이 붙은 진행건만 「진행」", () => {
  it("진행 2 번호 기록은 진행 1 상태를 바꾸지 않는다", () => {
    const todo = { id: "t", contractRef: "2026-10-07|예시상사", institutionRef: "소진공", slot: 2 } as never;
    const items = buildWorkStatusItems([cp("소진공", "소진공")], [todo], "2026-10-23");
    expect(items.map((i) => i.slot)).toEqual([1, 2]);
  });
});

describe("시트 Q 칸", () => {
  it("1~3 만 번호로, 빈칸·이상값은 null", () => {
    const base = ["id1", "c", "기관", "업체", "기타", "제목", "2026-10-23", "", "", "", true, false, "", "", "", "todo"];
    expect(rowToTodo([...base, 2])?.slot).toBe(2);
    expect(rowToTodo([...base, "3"])?.slot).toBe(3);
    expect(rowToTodo([...base, ""])?.slot).toBeNull();
    expect(rowToTodo([...base, 7])?.slot).toBeNull();
    expect(rowToTodo(base)?.slot).toBeNull();
  });
});
