/**
 * Layer: service — 해지 계약 '계약 수' 제외 (contract-count-exclude-terminated).
 *
 * 순수함수 모음. 해지 계약(02 AL 해지일)을 **04 미팅 파생 계약수**에서 차감하기 위한
 * 오버레이 입력만 생산한다 — 원값(시트 수식 / DB twin) 파이프라인은 절대 건드리지 않는다.
 * 판정은 재구현하지 않고 @/types 의 것을 재사용한다(단일 결정점).
 *
 * SoR: docs/plans/active/contract-count-exclude-terminated.md §2·§3
 */
import { Channel, isTerminatedContract } from "@/types";
import type { ContractPayment, Meeting } from "@/types";
import { weekIndexOf } from "@/repo/sales";

/** "YYYY-MM-DD" → 로컬 자정 Date (dashboard-aggregates.parseISO 와 동일 규칙 — 주차 버킷 패리티). */
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
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
 *  - 1차: `linkedMeetingId`(02 AK) → `meeting.id`, 2차 폴백: `계약일`(=미팅날짜) + `업체명`.
 *  - **차감은 raw(channelStackingFromDb)가 실제로 센 미팅에만** = `계약여부 && 구분!=="이월"`.
 *    payment 기준 이월판정(isCarryoverContract = flag OR 계약일<시작)으로 게이트하면, 미팅 flag
 *    는 native 인데 계약일<시작인 **날짜-캐리오버** 계약이 raw(미팅 flag 로만 이월 제외)엔 계상되나
 *    차감은 스킵돼 **과다계상**된다(#549 후 DevD parity 발견). → 미팅 flag 기준으로 raw 와 대칭화.
 *  - 귀속 실패(링크·폴백 모두 미스): `unknown` 누적(채널합 누락, 호출부 로깅).
 * 순수함수. 음수 클램프는 오버레이(applyTerminationExclusion) 몫.
 */
export function terminatedByChannel(
  payments: ContractPayment[],
  meetings: Meeting[],
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
    if (!isTerminatedContract(p)) continue;
    const linked = p.linkedMeetingId ? byId.get(p.linkedMeetingId) : undefined;
    const m = linked ?? byKey.get(`${p.계약일}|${p.업체명}`);
    if (!m) {
      unknown += 1; // 귀속 실패 — 채널별 미반영
      continue;
    }
    // raw(channelStacking) 포함조건과 대칭: 그 미팅이 실제 계상된 것만 차감.
    if (!m.계약여부 || m.구분 === "이월") continue;
    byChannel[m.channel] += 1;
  }
  return { byChannel, unknown };
}

/**
 * 주차축(1~8) 해지 계약 차감 수 — 대시보드 8주 추이·아레나(주차 파생 계약수)용.
 *
 * ⚠️ 채널축(terminatedByChannel)과 **판정 규칙이 다르다**: 여기선 이월을 필터하지 않고
 * **plain `isTerminatedContract`** 를 쓴다. 근거 — raw(weeklyContractsFromDb / 시트 N·C33:H40)는
 * CARRYOVER 플래그 필터 없이 `상태=계약` 을 미팅날짜 주차로만 세므로, 정합하려면 차감도
 * 이월 해지를 빼야 under-subtract 가 안 난다. 날짜기반 이월(계약일<시작=week0)은 아래
 * **주차 가드(1~8)** 가 raw 와 동일하게 자연 제외 → 이중차감 불가.
 *
 * 미팅 불요: 계약의 `계약일`(=연결 미팅의 미팅날짜)로 버킷팅. weekIndexOf·parseISO 는
 * weeklyContractsFromDb 와 동일 규칙(주차 경계 패리티).
 */
export function terminatedByWeek(
  payments: ContractPayment[],
  courseStart: Date,
): number[] {
  const weeks = new Array<number>(8).fill(0);
  for (const p of payments) {
    if (!isTerminatedContract(p)) continue;
    const d = (p.계약일 ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const w = weekIndexOf(parseISO(d), courseStart);
    // 8주 밖(0·9·10)은 raw 도 미포함 → 차감 안 함. (noUncheckedIndexedAccess 대응)
    if (w >= 1 && w <= 8) weeks[w - 1] = (weeks[w - 1] ?? 0) + 1;
  }
  return weeks;
}

/** 8주 내 해지 계약 총수 — 아레나 계약왕·기수평균 총합용(주차별 합, terminatedByWeek 와 동일 정의). */
export function countTerminatedInWeeks(
  payments: ContractPayment[],
  courseStart: Date,
): number {
  return terminatedByWeek(payments, courseStart).reduce((a, b) => a + b, 0);
}
