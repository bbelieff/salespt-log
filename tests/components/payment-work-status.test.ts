import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import { buildWorkStatusItems, classifyWorkStatus } from "@/app/(app)/payment/_lib/work-status";

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...over });
const contract = (over: Partial<ContractPayment> = {}): ContractPayment => ({ row: 3, 계약일: "2026-09-01", 업체명: "한빛", 수임비: 100, 계약비고: "", 공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false, 사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false, 수납1: slot(), 수납2: slot(), 수납3: slot(), 로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...over } as ContractPayment);

describe("업무현황 분류", () => {
  it("수납완료 > 수납대기 > 승인 > 진행 > 진행대기 순으로 한 건에 한 상태만 준다", () => {
    expect(classifyWorkStatus(slot({ 수납액: 1 }), false, "2026-09-27")).toBe("collected");
    expect(classifyWorkStatus(slot({ 승인금액: 100, 수납일: "2026-09-28" }), false, "2026-09-27")).toBe("collection-waiting");
    expect(classifyWorkStatus(slot({ 승인금액: 100 }), false, "2026-09-27")).toBe("approved");
    expect(classifyWorkStatus(slot({ 메모: "통화" }), false, "2026-09-27")).toBe("progress");
    expect(classifyWorkStatus(slot({ 진행기관: "소진공" }), false, "2026-09-27")).toBe("waiting");
  });
  it("등록만 된 계약은 진행대기 1건, Todo가 있으면 진행 1건이다", () => {
    expect(buildWorkStatusItems([contract()], [], "2026-09-27")).toMatchObject([{ status: "waiting", slot: 1 }]);
    const cp = contract({ 수납1: slot({ 진행기관: "소진공" }) });
    const todo = { contractRef: "2026-09-01|한빛", institutionRef: "소진공" } as Todo;
    expect(buildWorkStatusItems([cp], [todo], "2026-09-27")[0]?.status).toBe("progress");
  });
});
