/**
 * 적던 내용이 있는 창을 닫을 때 한 번 묻는 공용 문구 (2026-11-10 UI 점검).
 * 창마다 다른 말 대신 하나의 일반적인 표현을 쓴다. 바꾼 게 없으면 묻지 않고 바로 닫는다.
 */
export const DISCARD_MESSAGE = "작성 중인 내용이 있어요.\n저장하지 않고 닫을까요?";

/** 닫아도 되면 true. dirty 가 아니면 묻지 않는다. */
export function confirmDiscard(dirty: boolean): boolean {
  return !dirty || window.confirm(DISCARD_MESSAGE);
}
