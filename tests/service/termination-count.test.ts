/**
 * 해지 계약 '계약 수' 제외 (contract-count-exclude-terminated) PR-A:
 *  ① isExcludedTermination (해지 & !이월) ② terminatedByChannel (linkedMeetingId 조인·폴백·unknown·이월 이중차감 방지)
 *  ③ applyTerminationExclusion 오버레이 (channelMatrix.계약 차감·음수 클램프·원본 무변=그림자 diff 0)
 */
import { describe, expect, it } from "vitest";
import { Channel, ContractPayment, Meeting } from "@/types";
import { isExcludedTermination, terminatedByChannel } from "@/service/termination-count";
import { applyTerminationExclusion } from "@/service/dashboard";

const COURSE = "2026-07-10"; // 수강시작 — 이후 계약일 = 이월 아님

function cp(over: Partial<ContractPayment>): ContractPayment {
  return ContractPayment.parse({ 계약일: COURSE, 업체명: "업체", 수임비: 1000, ...over });
}

function mt(over: Partial<Meeting> & { id: string }): Meeting {
  return {
    예약일: COURSE, 예약시각: "10:00", 미팅날짜: COURSE, 미팅시간: "10:00",
    channel: "직접생산", 업체명: "업체", 장소: "장소", 예약비고: "",
    상태: "계약", 계약여부: true, 수임비: 1000, 미팅사유: "", 계약조건: "",
    ...over,
  } as Meeting;
}

function chan(p: Partial<Record<Channel, number>>): Record<Channel, number> {
  const base = {} as Record<Channel, number>;
  for (const c of Channel.options) base[c] = p[c] ?? 0;
  return base;
}

describe("isExcludedTermination — 해지 & 이월 아님", () => {
  it("해지(해지일)이고 이월 아니면 true", () => {
    expect(isExcludedTermination(cp({ 해지일: "2026-07-15" }), COURSE)).toBe(true);
  });
  it("이월(구분=이월) 해지는 제외 대상 아님 — 이중차감 방지", () => {
    expect(isExcludedTermination(cp({ 해지일: "2026-07-15", 구분: "이월" }), COURSE)).toBe(false);
  });
  it("이월(계약일<시작일) 해지도 제외 대상 아님", () => {
    expect(isExcludedTermination(cp({ 계약일: "2026-07-01", 해지일: "2026-07-15" }), COURSE)).toBe(false);
  });
  it("미해지 계약은 대상 아님", () => {
    expect(isExcludedTermination(cp({}), COURSE)).toBe(false);
  });
});

describe("terminatedByChannel — 해지→미팅 채널 귀속", () => {
  it("linkedMeetingId(AK) 로 미팅 채널 조인", () => {
    const payments = [cp({ 업체명: "A", 해지일: "2026-07-15", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "현수막", 업체명: "A" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings, COURSE);
    expect(byChannel["현수막"]).toBe(1);
    expect(unknown).toBe(0);
  });

  it("linkedMeetingId 결측 → 업체명+계약일 폴백 매칭", () => {
    const payments = [cp({ 업체명: "B", 계약일: "2026-07-12", 해지일: "2026-07-15" })];
    const meetings = [mt({ id: "m9", channel: "매입DB", 업체명: "B", 미팅날짜: "2026-07-12" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings, COURSE);
    expect(byChannel["매입DB"]).toBe(1);
    expect(unknown).toBe(0);
  });

  it("귀속 실패(링크·폴백 모두 미스) → unknown, 채널별 0", () => {
    const payments = [cp({ 업체명: "없는곳", 해지일: "2026-07-15", linkedMeetingId: "zzz" })];
    const meetings = [mt({ id: "m1", channel: "직접생산", 업체명: "다른곳" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings, COURSE);
    expect(unknown).toBe(1);
    expect(Object.values(byChannel).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("이월 해지는 차감 대상에서 제외(이중차감 방지)", () => {
    const payments = [cp({ 업체명: "C", 해지일: "2026-07-15", 구분: "이월", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "직접생산", 업체명: "C" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings, COURSE);
    expect(Object.values(byChannel).reduce((a, b) => a + b, 0)).toBe(0);
    expect(unknown).toBe(0);
  });

  it("미해지 계약은 무시, 여러 채널 합산", () => {
    const payments = [
      cp({ 업체명: "A", 해지일: "2026-07-15", linkedMeetingId: "m1" }),
      cp({ 업체명: "B", 해지일: "2026-07-16", linkedMeetingId: "m2" }),
      cp({ 업체명: "C", linkedMeetingId: "m3" }), // 미해지
    ];
    const meetings = [
      mt({ id: "m1", channel: "직접생산", 업체명: "A" }),
      mt({ id: "m2", channel: "직접생산", 업체명: "B" }),
      mt({ id: "m3", channel: "매입DB", 업체명: "C" }),
    ];
    const { byChannel } = terminatedByChannel(payments, meetings, COURSE);
    expect(byChannel["직접생산"]).toBe(2);
    expect(byChannel["매입DB"]).toBe(0);
  });
});

describe("applyTerminationExclusion — 오버레이(차감·클램프·원본 무변)", () => {
  function view(matrix: { 채널: Channel; 계약: number }[]) {
    return {
      kpi: {},
      channelMatrix: matrix.map((m) => ({
        채널: m.채널, 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: m.계약,
      })),
      weeklyTrend: [],
      costBreakdown: [],
      콜지기소수임비: 0,
    } as unknown as import("@/types").DashboardView;
  }

  it("channelMatrix.계약 에서 차감", () => {
    const out = applyTerminationExclusion(view([{ 채널: "직접생산", 계약: 5 }]), chan({ 직접생산: 2 }));
    expect(out.channelMatrix[0]!.계약).toBe(3);
  });

  it("음수 클램프 — 차감이 raw 보다 크면 0", () => {
    const out = applyTerminationExclusion(view([{ 채널: "현수막", 계약: 1 }]), chan({ 현수막: 3 }));
    expect(out.channelMatrix[0]!.계약).toBe(0);
  });

  it("원본 view 무변(그림자 diff 0 사수) — 새 객체 반환, 입력 불변", () => {
    const raw = view([{ 채널: "직접생산", 계약: 5 }]);
    const out = applyTerminationExclusion(raw, chan({ 직접생산: 2 }));
    expect(out).not.toBe(raw); // 새 view
    expect(out.channelMatrix[0]).not.toBe(raw.channelMatrix[0]); // 새 entry
    expect(raw.channelMatrix[0]!.계약).toBe(5); // 원본 그대로 (그림자가 이걸 봄)
    expect(out.channelMatrix[0]!.계약).toBe(3);
  });

  it("차감 0 이면 동일 참조 반환(불필요 복사 없음)", () => {
    const raw = view([{ 채널: "직접생산", 계약: 5 }]);
    expect(applyTerminationExclusion(raw, chan({}))).toBe(raw);
  });
});
