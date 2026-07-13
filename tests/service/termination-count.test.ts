/**
 * 해지 계약 '계약 수' 제외 (contract-count-exclude-terminated) PR-A:
 *  ① terminatedByChannel (linkedMeetingId 조인·폴백·unknown·미팅 raw 포함조건과 대칭=과다계상 방지)
 *  ③ applyTerminationExclusion 오버레이 (channelMatrix.계약 차감·음수 클램프·원본 무변=그림자 diff 0)
 */
import { describe, expect, it } from "vitest";
import { Channel, ContractPayment, Meeting } from "@/types";
import {
  countTerminatedInWeeks,
  terminatedByChannel,
  terminatedByWeek,
} from "@/service/termination-count";
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

describe("terminatedByChannel — 해지→미팅 채널 귀속 (raw 미팅 포함조건과 대칭)", () => {
  it("linkedMeetingId(AK) 로 미팅 채널 조인", () => {
    const payments = [cp({ 업체명: "A", 해지일: "2026-07-15", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "현수막", 업체명: "A" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings);
    expect(byChannel["현수막"]).toBe(1);
    expect(unknown).toBe(0);
  });

  it("linkedMeetingId 결측 → 업체명+계약일 폴백 매칭", () => {
    const payments = [cp({ 업체명: "B", 계약일: "2026-07-12", 해지일: "2026-07-15" })];
    const meetings = [mt({ id: "m9", channel: "매입DB", 업체명: "B", 미팅날짜: "2026-07-12" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings);
    expect(byChannel["매입DB"]).toBe(1);
    expect(unknown).toBe(0);
  });

  it("귀속 실패(링크·폴백 모두 미스) → unknown, 채널별 0", () => {
    const payments = [cp({ 업체명: "없는곳", 해지일: "2026-07-15", linkedMeetingId: "zzz" })];
    const meetings = [mt({ id: "m1", channel: "직접생산", 업체명: "다른곳" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings);
    expect(unknown).toBe(1);
    expect(Object.values(byChannel).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("미팅 flag='이월' → 차감 안 함 (raw 가 이월 미팅 제외 → 이중차감 방지)", () => {
    const payments = [cp({ 업체명: "C", 해지일: "2026-07-15", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "직접생산", 업체명: "C", 구분: "이월" })];
    const { byChannel, unknown } = terminatedByChannel(payments, meetings);
    expect(Object.values(byChannel).reduce((a, b) => a + b, 0)).toBe(0);
    expect(unknown).toBe(0);
  });

  it("미팅 계약여부=false → 차감 안 함 (raw 가 안 셈)", () => {
    const payments = [cp({ 업체명: "D", 해지일: "2026-07-15", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "직접생산", 업체명: "D", 계약여부: false })];
    const { byChannel } = terminatedByChannel(payments, meetings);
    expect(Object.values(byChannel).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("🐛회귀(#549): 날짜-캐리오버(계약일<시작)여도 미팅 native면 차감 — raw 가 계상했으므로", () => {
    // payment 계약일<시작(=payment 이월)이나 미팅 flag native·계약여부=true → raw channelStacking 계상.
    // 과거 isExcludedTermination(payment 이월제외)은 차감 스킵=과다계상. 미팅 게이트는 정확히 차감.
    const payments = [cp({ 업체명: "E", 계약일: "2026-07-01", 해지일: "2026-07-15", linkedMeetingId: "m1" })];
    const meetings = [mt({ id: "m1", channel: "매입DB", 업체명: "E", 미팅날짜: "2026-07-11" })];
    const { byChannel } = terminatedByChannel(payments, meetings);
    expect(byChannel["매입DB"]).toBe(1);
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
    const { byChannel } = terminatedByChannel(payments, meetings);
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

describe("terminatedByWeek / countTerminatedInWeeks — 주차축(아레나·8주)", () => {
  const CS = new Date(2026, 6, 10); // 2026-07-10 로컬 자정 = 1주차 시작

  it("계약일 주차(1~8)로 버킷 — plain isTerminated(이월도 포함)", () => {
    const payments = [
      cp({ 계약일: "2026-07-10", 해지일: "2026-07-20" }), // 1주차
      cp({ 계약일: "2026-07-17", 해지일: "2026-07-25" }), // 2주차
      cp({ 계약일: "2026-08-28", 해지일: "2026-08-30" }), // 8주차(+49일)
      cp({ 계약일: "2026-07-11", 구분: "이월", 해지일: "2026-07-20" }), // 이월 해지도 차감(채널축과 다름)
    ];
    const w = terminatedByWeek(payments, CS);
    expect(w[0]).toBe(2); // 1주차: 정상 1 + 이월 1
    expect(w[1]).toBe(1); // 2주차
    expect(w[7]).toBe(1); // 8주차
    expect(countTerminatedInWeeks(payments, CS)).toBe(4);
  });

  it("주차 가드 — 시작 전(week0)·8주 밖(week9+) 해지는 차감 안 함", () => {
    const payments = [
      cp({ 계약일: "2026-07-09", 해지일: "2026-07-20" }), // 시작 하루 전 = week0
      cp({ 계약일: "2026-09-04", 해지일: "2026-09-10" }), // +56일 = week9
    ];
    expect(countTerminatedInWeeks(payments, CS)).toBe(0);
    expect(terminatedByWeek(payments, CS).every((x) => x === 0)).toBe(true);
  });

  it("미해지·빈 계약일은 무시", () => {
    const payments = [
      cp({ 계약일: "2026-07-10" }), // 미해지
      cp({ 계약일: "", 해지일: "2026-07-20" }), // 계약일 없음
    ];
    expect(countTerminatedInWeeks(payments, CS)).toBe(0);
  });
});
