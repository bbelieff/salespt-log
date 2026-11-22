/**
 * 일정 변경 표시 「(변경)」 — 일정·계약 탭에서 미팅 날짜를 바꾸면 새 미팅 업체명 앞에 붙는다
 * (`app/(app)/schedule/_lib/useMeetingActions.ts` handleReschedule). 화면에서 바뀐 카드를 알아보는
 * 용도일 뿐이라, 계약(실무/수납 장부·업체정보)에는 실제 업체명으로 들어가야 한다(2026-11-22 belie).
 * 순수 함수 — import 없음.
 */

/** 앞의 「(변경)」 표시(여러 번 붙었어도)를 떼어 낸 실제 업체명. 떼고 나서 비면 원래 이름을 그대로 둔다. */
export function stripRescheduleMark(name: string): string {
  const raw = (name ?? "").trim();
  const clean = raw.replace(/^(?:\(변경\)\s*)+/, "").trim();
  return clean || raw;
}

/** 이름 앞에 「(변경)」 표시가 붙어 있나. */
export function hasRescheduleMark(name: string): boolean {
  return /^\s*\(변경\)/.test(name ?? "");
}
