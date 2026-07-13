/**
 * Layer: service — 해지 계약 '계약 수' 제외 (contract-count-exclude-terminated).
 *
 * 순수함수 모음. 해지 계약(02 AL 해지일)을 **04 미팅 파생 계약수**에서 차감하기 위한
 * 오버레이 입력만 생산한다 — 원값(시트 수식 / DB twin) 파이프라인은 절대 건드리지 않는다.
 * 판정은 재구현하지 않고 @/types 의 것을 재사용한다(단일 결정점).
 *
 * SoR: docs/plans/active/contract-count-exclude-terminated.md §2·§3
 */
import { Channel, isCarryoverContract, isTerminatedContract } from "@/types";
import type { ContractPayment, Meeting } from "@/types";

/**
 * 계약수에서 차감할 해지 계약 판정 = 해지됨(해지일 존재) **그리고** 이월 아님.
 * 이월 계약은 퍼널 raw(channelStacking / weeklyContracts)가 이미 제외 → 이중차감 방지.
 */
export function isExcludedTermination(
  p: { 해지일?: string; 구분?: string; 계약일?: string },
  courseStartISO: string,
): boolean {
  return isTerminatedContract(p) && !isCarryoverContract(p, courseStartISO);
}

/** 빈 채널×0 레코드 (Channel enum 정본). */
function emptyChannelCount(): Record<Channel, number> {
  const rec = {} as Record<Channel, number>;
  for (const c of Channel.options) rec[c] = 0;
  return rec;
}

export interface TerminatedByChannel {
  /** 채널별 차감 계약수 (귀속 성공분만). */
  byChannel: Record<Channel, number>;
  /** 미팅 귀속 실패(linkedMeetingId·폴백 모두 미스) — 채널별엔 미반영, 호출부가 로깅. */
  unknown: number;
}

/**
 * 해지 계약 → 연결 미팅(04)의 channel 로 귀속해 채널별 차감 수를 만든다.
 *  - 1차: `linkedMeetingId`(02 AK) → `meeting.id`
 *  - 2차 폴백(레거시 링크 결측): `계약일`(=미팅날짜) + `업체명`
 *  - 둘 다 실패: `unknown` 누적(채널합에서 누락, 총합은 countTerminatedTotal 이 담당).
 * 순수함수 — 로깅·부수효과 없음. 음수 클램프는 오버레이(applyTerminationExclusion) 몫.
 */
export function terminatedByChannel(
  payments: ContractPayment[],
  meetings: Meeting[],
  courseStartISO: string,
): TerminatedByChannel {
  const byId = new Map<string, Meeting>();
  const byKey = new Map<string, Meeting>(); // `${미팅날짜}|${업체명}` — 첫 매칭 우선
  for (const m of meetings) {
    if (m.id) byId.set(m.id, m);
    const key = `${m.미팅날짜}|${m.업체명}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }

  const byChannel = emptyChannelCount();
  let unknown = 0;
  for (const p of payments) {
    if (!isExcludedTermination(p, courseStartISO)) continue;
    const linked = p.linkedMeetingId ? byId.get(p.linkedMeetingId) : undefined;
    const m = linked ?? byKey.get(`${p.계약일}|${p.업체명}`);
    if (m) {
      byChannel[m.channel] += 1;
    } else {
      unknown += 1;
    }
  }
  return { byChannel, unknown };
}
