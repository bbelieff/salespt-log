/**
 * 테스트 도우미 — DateInputCustom(직접 그리는 달력)에서 날짜를 고른다.
 * 네이티브 `<input type="date">` 가 아니라 값을 직접 넣을 수 없으니, 사람이 하듯
 * 칸을 눌러 달력을 열고 ‹ › 로 그 달까지 간 뒤 날짜를 누른다.
 */
import { act } from "react";

export function pickDate(trigger: Element, iso: string): void {
  const click = (node: Element) =>
    act(() => {
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  click(trigger);
  const [y = 0, m = 0] = iso.split("-").map(Number);
  for (let i = 0; i < 240; i += 1) {
    if (document.querySelector(`.date-pop-day[aria-label="${iso}"]:not(.is-out)`)) break;
    const title = document.querySelector(".date-pop-title")?.textContent ?? "";
    const [ty = 0, tm = 0] = (title.match(/\d+/g) ?? []).map(Number);
    const forward = ty < y || (ty === y && tm < m);
    const nav = document.querySelector(`.date-pop-nav[aria-label="${forward ? "다음 달" : "이전 달"}"]`);
    if (!nav) throw new Error("달력이 열리지 않았다");
    click(nav);
  }
  const day = document.querySelector(`.date-pop-day[aria-label="${iso}"]:not(.is-out)`);
  if (!day) throw new Error(`달력에 ${iso} 가 없다`);
  click(day);
}
