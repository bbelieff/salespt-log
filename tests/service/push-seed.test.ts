/** 「오늘의 씨앗」 (belie 2026-10-24) — 0건인 아침의 다시 걸어 볼 거리. 합성 업체·날짜. */
import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";
import { buildSeedMessage, noRecentInflow, quietContracts } from "@/service/push-seed";

const TODAY = "2026-10-26";
const lead = (p: Partial<DbSheetLead>): DbSheetLead => ({
  id: "00000000-0000-4000-8000-000000000001", supplier: "", date: "2026-09-01", channel: "매입DB", company: "새봄유통", next: "", memo: "",
  result: "부재", stage: "DB컨택중", meetingId: null, first: "", revision: 1, ...p,
} as unknown as DbSheetLead);
const slot = (p: Partial<PaymentSlot> = {}): PaymentSlot => ({ 진행기관: "신용보증기금", 진행상품: "운전자금", 진행률: "50%", 승인금액: "", 수납금액: "", 대기기간: "", ...p } as unknown as PaymentSlot);
const contract = (p: Partial<ContractPayment> = {}): ContractPayment => ({ row: 7, 계약일: "2026-09-20", 업체명: "한빛상사", 수납1: slot(), 수납2: slot({ 진행기관: "", 진행상품: "", 진행률: "" }), 수납3: slot({ 진행기관: "", 진행상품: "", 진행률: "" }), ...p } as unknown as ContractPayment);
const todo = (p: Partial<Todo>): Todo => ({ id: "t1", contractRef: "2026-09-20|한빛상사", institutionRef: "신용보증기금", 업체명: "한빛상사", type: "전화", 제목: "근황", 예정일자: "2026-10-01", 예정시각: "", 장소: "", 상세: "", showOnCalendar: true, 완료여부: true, 생성시각: "", 분류: "", 기록종류: "todo", ...p } as Todo);

describe("noRecentInflow", () => {
  it("is true only when the person has DB records but none in the last 7 days", () => {
    expect(noRecentInflow([lead({ date: "2026-10-01" })], TODAY)).toBe(true);
    expect(noRecentInflow([lead({ date: "2026-10-20" })], TODAY)).toBe(false);
    expect(noRecentInflow([], TODAY)).toBe(false);
  });
});

describe("quietContracts", () => {
  it("finds open work quiet for 14+ days with no next todo, skipping closed or planned ones", () => {
    expect(quietContracts([contract()], [todo({})], TODAY).map(c => c.row)).toEqual([7]);
    expect(quietContracts([contract()], [todo({ 예정일자: "2026-10-20" })], TODAY)).toEqual([]); // recent activity
    expect(quietContracts([contract()], [todo({}), todo({ id: "t2", 완료여부: false, 예정일자: "2026-11-10" })], TODAY)).toEqual([]); // next step planned
    expect(quietContracts([contract({ 수납1: slot({ 진행률: "중도중지" }) })], [], TODAY)).toEqual([]); // nothing open
  });
});

describe("buildSeedMessage", () => {
  const oldLead = lead({ result: "단순거절", date: "2026-07-01" });
  it("offers new DB first when none came in for a week", () => {
    const m = buildSeedMessage({ leads: [oldLead] }, true, TODAY)!;
    expect(m).toMatchObject({ messageId: "morning.seed.inflow.v1", url: "/db-sheet", body: "오늘 챙길 일은 없어요. 최근 일주일 새 DB가 없어요. 오늘 채워 볼까요?" });
  });
  it("quiet work names the company, or only the count when names are hidden", () => {
    const m = buildSeedMessage({ leads: [], contracts: [contract()], todos: [todo({})] }, true, TODAY)!;
    expect(m.body).toBe("오늘 챙길 일은 없어요. 한빛상사 진행건이 2주째 조용해요. 근황을 물어볼까요?");
    expect(m.url).toBe("/payment?row=7");
    const hidden = buildSeedMessage({ contracts: [contract()], todos: [todo({})] }, false, TODAY)!;
    expect(hidden.body).toBe("오늘 챙길 일은 없어요. 2주째 조용한 진행건이 1건 있어요. 근황을 물어볼까요?");
    expect(hidden.url).toBe("/payment");
  });
  it("rests a seed sent in the last two messages: next kind, else nothing", () => {
    const src = { leads: [oldLead], contracts: [contract()], todos: [todo({})] };
    expect(buildSeedMessage(src, true, TODAY, ["morning.seed.inflow.v1"])!.messageId).toBe("morning.seed.work.v1");
    expect(buildSeedMessage(src, true, TODAY, ["morning.seed.work.v1", "morning.seed.inflow.v1"])).toBeNull();
    expect(buildSeedMessage(src, true, TODAY, ["evening.left.v1", "morning.overdue.v1", "morning.seed.inflow.v1"])!.messageId).toBe("morning.seed.inflow.v1");
  });
  it("sends nothing without a seed", () => {
    expect(buildSeedMessage({ leads: [lead({ date: "2026-10-25", result: "컨택진행" })] }, true, TODAY)).toBeNull();
  });
});
