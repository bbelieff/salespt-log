/**
 * PC 머리줄 한 줄 정리(2026-11-22 belie 확정) — 로고·「12기 ○○○ 대표님」을 PC 학생 화면(.desktop-shell)에서
 * 사이드탭 맨 위로 옮긴다. 이름·새소식 점·시트 링크는 TopHeader 가 계산해 이 작은 저장소에 올리고,
 * 사이드탭(DesktopNav)은 읽어서 보여 준다(mobile-nav 와 같은 방식 — 둘은 서로 다른 나무).
 * 사이드탭의 로고를 누르면 TopHeader 의 계정 메뉴를 그 로고 아래에 연다(openAccountMenu).
 */
import { useSyncExternalStore } from "react";

export interface HeaderIdentity {
  /** 「12기 김재원 대표님」 */
  display: string;
  /** 본인 시트 주소(시트 있는 수강생만) — 이름을 누르면 연다. */
  sheetHref: string | null;
  /** 새소식·새 배지·새 하루요약 점의 읽기 이름. null = 점 없음. */
  dotLabel: string | null;
}

const EMPTY: HeaderIdentity = { display: "", sheetHref: null, dotLabel: null };
let current: HeaderIdentity = EMPTY;
const listeners = new Set<() => void>();

export function setHeaderIdentity(next: HeaderIdentity) {
  if (current.display === next.display && current.sheetHref === next.sheetHref && current.dotLabel === next.dotLabel) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHeaderIdentity(): HeaderIdentity {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

/** 계정 메뉴 열기 요청 — 사이드탭 로고가 보낸다. anchor = 누른 로고의 화면 위치. */
export const ACCOUNT_MENU_EVENT = "salespt:account-menu";
export function openAccountMenu(anchor: DOMRect) {
  window.dispatchEvent(new CustomEvent(ACCOUNT_MENU_EVENT, { detail: { left: anchor.left, bottom: anchor.bottom } }));
}
