/**
 * 계약 연결 키 「계약일|업체명」 — 할 일·이력·업체정보 보관이 계약을 가리키는 안정 키(행번호 아님).
 * 순수 함수, import 없음. (2026-10-19 구조 개선 ⑤: 10곳이 따로 만들며 공백 처리가 달라
 * 업체명 앞뒤 공백이 있으면 할 일 연결이 조용히 끊길 수 있었다.)
 *
 * 새 키는 앞뒤 공백을 지워 만든다. 이미 저장된 키는 다시 쓰지 않고, **비교할 때 양쪽을 같이 다듬는다.**
 */

/** 계약일·업체명 → 키(앞뒤 공백 제거). */
export function contractRef(계약일: string, 업체명: string): string {
  return `${계약일.trim()}|${업체명.trim()}`;
}

/** 저장된 키를 비교용으로 다듬는다 — 첫 「|」 앞뒤를 각각 trim. */
export function normalizeContractRef(ref: string): string {
  const i = ref.indexOf("|");
  return i < 0 ? ref.trim() : `${ref.slice(0, i).trim()}|${ref.slice(i + 1).trim()}`;
}

/** 두 키가 같은 계약인가(공백 차이 무시). */
export function sameContractRef(a: string, b: string): boolean {
  return normalizeContractRef(a) === normalizeContractRef(b);
}
