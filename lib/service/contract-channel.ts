/**
 * Layer: service — 계약 행 → 연결 미팅(채널) 찾기. 순수 함수(repo import 없음).
 *
 * 규칙 하나를 두 곳이 같이 쓴다:
 *  - termination-count: 해지 계약을 미팅 채널로 귀속(채널별 계약 수 차감).
 *  - dashboard: 영업이익 상세 「채널별 남은 돈」 표의 계약별 채널(2026-10-12 #7).
 *
 * 1차 AK(linkedMeetingId) → meeting.id, 2차 `계약일|업체명` → 첫 일치 미팅(미팅을 연결하면
 * 계약일 = 미팅날짜, contract-meeting-link). `manual:`(영업기록 없이 추가)은 미팅이 없다.
 * 미팅 상태·이월 여부로 거르지 않는다 — 채널 출처만 돌려준다(거르기는 호출부 몫).
 * 유입 경로(#10)가 생기면 그 값을 먼저 쓰고 이 미팅 채널은 대체값으로 둔다(합의 메모).
 */
import type { ContractPayment, DashboardContractChannel, Meeting } from "@/types";
import { contractChannelKey, isManualContractLink } from "@/util/contract-link";

type ContractRef = Pick<ContractPayment, "linkedMeetingId" | "계약일" | "업체명">;

/** 미팅 목록으로 「계약 → 연결 미팅」 조회 함수를 만든다. 못 찾으면 undefined. */
export function contractMeetingResolver(meetings: readonly Meeting[]): (p: ContractRef) => Meeting | undefined {
  const byId = new Map<string, Meeting>();
  const byKey = new Map<string, Meeting>(); // `${미팅날짜}|${업체명}` — 첫 매칭 우선
  for (const m of meetings) {
    if (m.id) byId.set(m.id, m);
    const key = `${m.미팅날짜}|${m.업체명}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }
  return (p) => {
    if (isManualContractLink(p.linkedMeetingId)) return undefined;
    const linked = p.linkedMeetingId ? byId.get(p.linkedMeetingId) : undefined;
    return linked ?? byKey.get(`${p.계약일}|${p.업체명}`);
  };
}

/** 계약 행마다 { key, channel } — 대시보드 응답 `contractChannels`. 새 읽기 없음(이미 가진 배열). */
export function contractChannels(
  payments: readonly ContractPayment[],
  meetings: readonly Meeting[],
): DashboardContractChannel[] {
  const resolve = contractMeetingResolver(meetings);
  return payments.map((p) => ({ key: contractChannelKey(p), channel: resolve(p)?.channel ?? null }));
}
