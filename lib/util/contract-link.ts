/**
 * 02 계약수납 AK(연결 미팅 id) 값 판별 — 순수 유틸(import 0).
 *
 * 「영업기록 없이 업체추가」(payment-standalone-company) 로 만든 계약행은 04 미팅이 없다.
 * 그래도 재시도 멱등(같은 요청키 → 같은 행)을 위해 AK 에 `manual:<requestKey>` 를 적는다.
 * 이 값은 **미팅 id 가 아니다** — 미팅을 찾거나 고치는 모든 곳은 이 함수로 걸러
 * "연결 미팅 없음" 으로 다룬다(가짜 조회·엉뚱한 미팅 연결 방지).
 */
export const MANUAL_CONTRACT_LINK_PREFIX = "manual:";

/** 요청키로 수동 계약행 링크값을 만든다. */
export function manualContractLink(requestKey: string): string {
  return `${MANUAL_CONTRACT_LINK_PREFIX}${requestKey}`;
}

/** AK 값이 「영업기록 없이 추가」한 계약행 표식인가. 빈 값·실제 미팅 id 는 false. */
export function isManualContractLink(link: string | null | undefined): boolean {
  return typeof link === "string" && link.trim().startsWith(MANUAL_CONTRACT_LINK_PREFIX);
}

/** 미팅 조회·수정에 써도 되는 진짜 미팅 id 만 돌려준다(수동 표식·빈 값 → undefined). */
export function meetingIdFromLink(link: string | null | undefined): string | undefined {
  if (!link || isManualContractLink(link)) return undefined;
  return link;
}
