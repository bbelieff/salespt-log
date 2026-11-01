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
    expect(todoSlotOf(cp("소진공", "소진공"), { institutionRef: "소진공" })).toEqual({ slot: 1, ambiguous: true, reason: "shared" });
  });
});

/**
 * 2026-10-23 「실무수납에서 todo 를 잡아도 챙길 일에서 안 사라진다」 — 실제 3건을 합성으로 재현.
 * 진행기관 칸을 나중에 짧게 고쳐(「소진공 혁신」→「소진공」) 옛 기록이 어느 진행건에도 안 붙어
 * 실무/수납 화면 어디에도 안 보였다 → 완료할 수 없으니 대시보드 「밀린 할 일」에 계속 남았다.
 */
describe("todoSlotOf — 기관 이름이 진행건과 다른 옛 기록도 한 진행건에 보인다", () => {
  it("업체 1: 진행건 「소진공 」(끝 공백) · 기록 「소진공 혁신」 → 진행 1, 확인 필요", () => {
    expect(todoSlotOf(cp("소진공 "), { institutionRef: "소진공 혁신" })).toEqual({ slot: 1, ambiguous: true, reason: "unmatched" });
  });
  it("업체 2: 진행건 「소진공」 · 기록 「소진공 일반경영안정자금」 → 진행 1, 확인 필요", () => {
    expect(todoSlotOf(cp("소진공"), { institutionRef: "소진공 일반경영안정자금" })).toEqual({ slot: 1, ambiguous: true, reason: "unmatched" });
  });
  it("업체 3: 진행 1 「신용보증기금 」 · 진행 2 「소진공」 · 기록 「소진공 신취」 → 진행 2(첫 진행건 아님)", () => {
    expect(todoSlotOf(cp("신용보증기금 ", "소진공"), { institutionRef: "소진공 신취" })).toEqual({ slot: 2, ambiguous: true, reason: "unmatched" });
  });
  it("단어 경계까지만 — 「소진공사」는 「소진공」 진행건으로 가지 않고 내용 있는 첫 진행건", () => {
    expect(todoSlotOf(cp("신보", "소진공"), { institutionRef: "소진공사" })).toEqual({ slot: 1, ambiguous: true, reason: "unmatched" });
  });
  it("전혀 다른 기관·빈 진행 1 이면 내용 있는 첫 진행건, 전부 비면 진행 1", () => {
    expect(todoSlotOf(cp("", "소진공"), { institutionRef: "기보" })).toEqual({ slot: 2, ambiguous: true, reason: "unmatched" });
    expect(todoSlotOf(cp(""), { institutionRef: "기보" })).toEqual({ slot: 1, ambiguous: true, reason: "unmatched" });
  });
  it("번호가 저장된 기록은 기관 이름과 상관없이 그 진행건으로 확정", () => {
    expect(todoSlotOf(cp("소진공"), { institutionRef: "소진공 혁신", slot: 1 })).toEqual({ slot: 1, ambiguous: false });
  });
});

describe("업무 현황 — 기록이 붙은 진행건만 「진행」", () => {
  it("진행 2 번호 기록은 진행 1 상태를 바꾸지 않는다", () => {
    const todo = { id: "t", contractRef: "2026-10-07|예시상사", institutionRef: "소진공", slot: 2 } as never;
    const items = buildWorkStatusItems([cp("소진공", "소진공")], [todo], "2026-10-23");
    expect(items.map((i) => i.slot)).toEqual([1, 2]);
  });
  it("기관 이름이 다른 옛 기록(추정 연결)은 「대기」를 「진행」으로 바꾸지 않는다", () => {
    const orphan = { id: "o", contractRef: "2026-10-07|예시상사", institutionRef: "소진공 혁신", slot: null } as never;
    const bare = { ...cp("소진공"), 수납1: { ...empty, 진행기관: "소진공" } } as ContractPayment;
    expect(buildWorkStatusItems([bare], [orphan], "2026-10-23")[0]?.status).toBe("waiting");
  });
});

describe("시트 Q 칸", () => {
  it("양의 정수는 번호로(4번부터 추가진행, 2026-10-31), 빈칸·이상값은 null", () => {
    const base = ["id1", "c", "기관", "업체", "기타", "제목", "2026-10-23", "", "", "", true, false, "", "", "", "todo"];
    expect(rowToTodo([...base, 2])?.slot).toBe(2);
    expect(rowToTodo([...base, "3"])?.slot).toBe(3);
    expect(rowToTodo([...base, ""])?.slot).toBeNull();
    expect(rowToTodo([...base, 7])?.slot).toBe(7);
    expect(rowToTodo([...base, 0])?.slot).toBeNull();
    expect(rowToTodo([...base, "2.5"])?.slot).toBeNull();
    expect(rowToTodo([...base, "x"])?.slot).toBeNull();
    expect(rowToTodo(base)?.slot).toBeNull();
  });
});
