/**
 * 진행률 「조건 대기」(단기관리·장기관리) + 업체 「장기관리」(2026-10-23 belie) 규칙.
 *  ① 옛 값·옛 기록 그대로 통과(하위 호환), 시트 미러는 빈 칸
 *  ② 조건 대기·단기관리 = 진행 중, 오늘 챙길 일 맨 뒤 / 조건 대기·장기관리 = 오늘 챙길 일 제외
 *  ③ 업체 자동 장기관리 = 진행건이 모두 수납완료·중도중지·조건 대기(장기관리), 직접 지정 우선
 *  ④ 직접 장기관리 후 새 진행건이 진행 중이 되면 저절로 진행
 *  ⑤ 장기관리 업체는 오늘 챙길 일에서 빠진다
 * 이름은 전부 합성('샘플').
 */
import { describe, expect, it } from "vitest";
import { ContractPayment, PaymentSlot, Progress } from "@/types";
import { averageProgress, isLongWaitSlot, isShortWaitSlot, isWaitingSlot, progressPct, waitTermOf } from "@/lib/analytics/contract-slots";
import { isSlotClosed } from "@/lib/analytics/payment-work-status";
import { activeSlotNumbers, autoCompanyStage, companyStage, isLongTermContract, movedToLongTerm, paymentListScope, stagePatch } from "@/lib/analytics/long-term";
import { buildStalledWork, buildTodoFollowUps, compareFollowUpUrgency, summarizeFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import { cpToRow } from "@/repo/contract-payment-row";
import { contractFromDbPayload } from "@/repo/db/read-daily";
import { userFieldsMirrorPayload } from "@/repo/db/contracts-clear";
import { TODAY, contract, slot, todo } from "./follow-ups-factories";

const shortWait = (over: Partial<PaymentSlot> = {}) => slot({ 진행기관: "기관A", 진행률: "조건 대기", 대기사유: "담보 설정 완료 기다림", 대기기간: "단기", ...over });
const longWait = (over: Partial<PaymentSlot> = {}) => shortWait({ 대기기간: "장기", ...over });
const collected = slot({ 진행기관: "기관B", 진행률: "100%", 수납액: 1_000_000 });
const halted = slot({ 진행기관: "기관C", 진행률: "중도중지" });
const live = slot({ 진행기관: "기관D", 진행률: "40%" });

describe("조건 대기 — 타입·저장 하위 호환", () => {
  it("옛 값·새 값 모두 통과, 옛 칸엔 새 필드가 없다", () => {
    for (const v of ["", "0%", "100%", "조건 대기", "중도중지"]) expect(Progress.parse(v)).toBe(v);
    const old = PaymentSlot.parse({ 진행률: "60%" });
    expect(old.대기사유).toBeUndefined();
    expect(old.대기기간).toBeUndefined();
    expect(PaymentSlot.safeParse({ 진행률: "조건 대기", 대기기간: "중기" }).success).toBe(false);
    const cp = ContractPayment.parse({ 계약일: "2026-09-01", 업체명: "샘플상사" });
    expect(cp.관리상태).toBeUndefined();
    expect(cp.관리상태진행건).toBeUndefined();
  });

  it("기간을 고르지 않은 조건 대기는 단기(진행 중)로 본다", () => {
    expect(waitTermOf(slot({ 진행률: "조건 대기" }))).toBe("단기");
    expect(waitTermOf(slot({ 진행률: "40%", 대기기간: "장기" }))).toBeNull();
    expect(isWaitingSlot(shortWait())).toBe(true);
    expect(isShortWaitSlot(shortWait())).toBe(true);
    expect(isLongWaitSlot(longWait())).toBe(true);
    expect(progressPct("조건 대기")).toBe(0);
  });

  it("시트 미러는 빈 칸, DB 정본은 사유·기간·업체 상태를 잃지 않는다", () => {
    const cp = contract({ 수납1: longWait(), 수납2: live, 관리상태: "장기관리", 관리상태진행건: [2] });
    const row = cpToRow(cp);
    expect(row[13]).toBe("");
    expect(row[19]).toBe("40%");
    const payload = userFieldsMirrorPayload(cp);
    expect(payload.관리상태).toBe("장기관리");
    expect(payload.관리상태진행건).toEqual([2]);
    const back = contractFromDbPayload({ 업체명: "샘플상사", 계약일: "2026-09-01", ...payload }, 6)!;
    expect(back.수납1).toMatchObject({ 진행률: "조건 대기", 대기사유: "담보 설정 완료 기다림", 대기기간: "장기" });
    expect(back.관리상태).toBe("장기관리");
    expect(back.관리상태진행건).toEqual([2]);
    // 옛 payload 엔 없음 → 자동.
    expect(contractFromDbPayload({ 업체명: "샘플상사", 계약일: "2026-09-01", 관리상태: "엉뚱함" }, 7)!.관리상태).toBeUndefined();
  });

  it("평균 진행률: 조건 대기는 진행 중(0%)으로 들어가고 중도중지만 빠진다", () => {
    expect(averageProgress([live, shortWait()])).toBe(20);
    expect(averageProgress([live, longWait(), halted])).toBe(20);
  });
});

describe("진행건 끝남 판정(isSlotClosed)", () => {
  it("단기관리는 수납액이 있어도 진행 중, 장기관리는 중도중지처럼 끝난 쪽", () => {
    expect(isSlotClosed(shortWait({ 수납액: 500_000 }), TODAY)).toBe(false);
    expect(isSlotClosed(longWait(), TODAY)).toBe(true);
    expect(isSlotClosed(halted, TODAY)).toBe(true);
    expect(isSlotClosed(collected, TODAY)).toBe(true);
    expect(isSlotClosed(live, TODAY)).toBe(false);
  });
});

describe("업체 장기관리", () => {
  it("자동: 진행건이 모두 수납완료·중도중지·조건 대기(장기관리)면 장기관리", () => {
    expect(autoCompanyStage(contract({ 수납1: collected, 수납2: halted, 수납3: longWait() }))).toBe("장기관리");
    expect(autoCompanyStage(contract({ 수납1: collected }))).toBe("장기관리");
    expect(autoCompanyStage(contract({ 수납1: collected, 수납2: shortWait() }))).toBe("진행");
    expect(autoCompanyStage(contract({ 수납1: longWait(), 수납2: live }))).toBe("진행");
    // 진행건이 없는 계약은 진행(아직 시작 전).
    expect(autoCompanyStage(contract())).toBe("진행");
  });

  it("직접 지정이 자동보다 우선 — 진행으로 되돌리면 진행", () => {
    const done = { 수납1: collected, 수납2: halted };
    expect(companyStage(contract({ ...done, 관리상태: "진행" }))).toBe("진행");
    expect(companyStage(contract({ 수납1: live, ...stagePatch(contract({ 수납1: live }), "장기관리") }))).toBe("장기관리");
    expect(stagePatch(contract({ 수납1: live, 수납2: shortWait() }), "장기관리")).toEqual({ 관리상태: "장기관리", 관리상태진행건: [1, 2] });
    expect(stagePatch(contract(), "진행")).toEqual({ 관리상태: "진행", 관리상태진행건: [] });
  });

  it("직접 장기관리 뒤 새 진행건이 진행 중이 되면 저절로 진행, 기존 진행건 변화로는 그대로", () => {
    const before = contract({ 수납1: live, 수납2: collected });
    const moved = { ...before, ...stagePatch(before, "장기관리") };
    expect(activeSlotNumbers(before)).toEqual([1]);
    expect(isLongTermContract(moved)).toBe(true);
    expect(isLongTermContract({ ...moved, 수납1: { ...live, 진행률: "60%" } })).toBe(true);
    expect(isLongTermContract({ ...moved, 수납3: slot({ 진행기관: "기관E" }) })).toBe(false);
    // 수납완료였던 진행 2가 조건 대기·단기관리로 다시 살아나도 새 진행 중 → 진행.
    expect(isLongTermContract({ ...moved, 수납2: shortWait({ 수납액: 1_000_000 }) })).toBe(false);
  });
});

describe("오늘 챙길 일", () => {
  it("조건 대기·장기관리 진행건은 할 일·멈춤에서 빠진다(업체는 다른 진행건으로 진행 유지)", () => {
    const cp = contract({ 수납1: longWait(), 수납2: slot({ 진행기관: "기관B" }) });
    const todos = [todo({ id: "a", institutionRef: "기관A", slot: 1 }), todo({ id: "b", institutionRef: "기관B", slot: 2 })];
    expect(buildTodoFollowUps(todos, [cp], TODAY).today.map((i) => i.key)).toEqual(["todo:b"]);
    expect(buildStalledWork([cp], [], TODAY).map((i) => i.slot)).toEqual([2]);
    expect(isLongTermContract(cp)).toBe(false);
  });

  it("조건 대기·단기관리는 남되 맨 뒤 — 미래 일정보다도 뒤", () => {
    const cp = contract({ row: 3, 수납1: shortWait(), 수납2: slot({ 진행기관: "기관B" }) });
    const todos = [
      todo({ id: "wait-overdue", institutionRef: "기관A", slot: 1, 예정일자: "2026-10-01" }),
      todo({ id: "normal-today", institutionRef: "기관B", slot: 2 }),
    ];
    const followUps = buildTodoFollowUps(todos, [cp], TODAY);
    const waitItem = followUps.overdue[0]!;
    expect(waitItem.deferred).toBe(true);
    expect(waitItem.reasons).toContain("조건 대기(단기관리)");
    expect(followUps.today[0]!.deferred).toBeUndefined();
    const summary = summarizeFollowUps({ contracts: [cp], todos }, TODAY);
    expect(summary.items.at(-1)?.key).toBe("todo:wait-overdue");
    expect(summary.total).toBe(2); // 세기는 그대로
    expect(compareFollowUpUrgency(waitItem, followUps.today[0]!)).toBeGreaterThan(0);
    const stalled = buildStalledWork([cp], [], TODAY);
    expect(stalled.find((i) => i.slot === 1)?.deferred).toBe(true);
  });

  it("장기관리 업체(자동·직접)는 할 일·멈춤 모두 빠진다", () => {
    const auto = contract({ row: 3, 수납1: collected });
    const manual = contract({ row: 4, 업체명: "샘플전기", 수납1: live, 관리상태: "장기관리", 관리상태진행건: [1] });
    const todos = [todo({ id: "x", institutionRef: "기관B", slot: 1 }), todo({ id: "y", contractRef: "2026-09-01|샘플전기", 업체명: "샘플전기", institutionRef: "기관D", slot: 1 })];
    const out = buildTodoFollowUps(todos, [auto, manual], TODAY);
    expect([...out.today, ...out.overdue, ...out.upcoming]).toEqual([]);
    expect(out.unlinked).toBe(0);
    expect(buildStalledWork([auto, manual], [], TODAY)).toEqual([]);
    // 진행으로 되돌리면 다시 올라온다.
    expect(buildStalledWork([{ ...manual, 관리상태: "진행" }], [], TODAY).map((i) => i.slot)).toEqual([1]);
  });
});

describe("검색은 장기관리 업체도 찾는다 (2026-10-27)", () => {
  const going = contract({ row: 3, 업체명: "샘플진행", 수납1: live });
  const done = contract({ row: 4, 업체명: "샘플끝남", 수납1: collected });
  it("검색어가 없으면 칩 범위만, 있으면 둘 다", () => {
    expect(paymentListScope([going, done], false, "").map((c) => c.row)).toEqual([3]);
    expect(paymentListScope([going, done], true, "").map((c) => c.row)).toEqual([4]);
    expect(paymentListScope([going, done], false, "샘플").map((c) => c.row)).toEqual([3, 4]);
    expect(paymentListScope([going, done], false, "  ").map((c) => c.row)).toEqual([3]);
  });
  it("수납을 다 받아 저절로 장기관리가 된 저장만 알린다", () => {
    expect(movedToLongTerm(going, { ...going, 수납1: collected })).toBe(true);
    expect(movedToLongTerm(done, done)).toBe(false);
    expect(movedToLongTerm(going, going)).toBe(false);
  });
});
