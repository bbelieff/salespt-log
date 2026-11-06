/**
 * 폰·태블릿(1024px 미만) 메뉴 서랍 열림 상태(2026-11-07 belie 「바텀탭 대신 사이드탭, 접혀 있을 땐 아예 안 보이게」).
 * 페이지 배너의 메뉴 버튼(TopHeader)과 사이드탭(DesktopNav)이 서로 다른 나무에 있어 작은 공용 저장소로 잇는다.
 */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setMobileNavOpen(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMobileNavOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

/** 서랍을 연 버튼 — 닫을 때 초점을 돌려준다. */
export const MOBILE_NAV_ID = "app-main-nav";

export function getMobileNavOpen(): boolean {
  return open;
}

/**
 * 손가락 밀기로 서랍 열고 닫기(2026-11-07 belie 「버튼뿐 아니라 왼쪽→오른쪽으로 밀어도」).
 * 가로로 60px 넘게, 세로 움직임의 두 배 넘게 밀었을 때만 — 세로 스크롤·당겨서 새로고침과 겹치지 않게.
 */
export const SWIPE_MIN = 60;
export function swipeIntent(isOpen: boolean, dx: number, dy: number): "open" | "close" | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dy) * 2 > Math.abs(dx)) return null;
  if (!isOpen && dx > 0) return "open";
  if (isOpen && dx < 0) return "close";
  return null;
}

const SWIPE_SKIP = 'input,textarea,select,[contenteditable="true"],[role="separator"],[role="slider"],[data-no-nav-swipe]';
/** 이 터치는 서랍 밀기로 쓰지 않는다: 입력 칸·크기 조절 손잡이, 왼쪽으로 더 밀 수 있는 가로 스크롤(표·칩 줄) 안. */
export function swipeBlocked(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches(SWIPE_SKIP)) return true;
    if (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft > 0) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}
