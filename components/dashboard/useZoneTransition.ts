"use client";
/**
 * 할 일 구역의 「이어지는 전환」(2026-11-24 belie) — View Transitions(document.startViewTransition + flushSync).
 * 펼침/접기 · 칩·단계로 좁히기 · 0건으로 접힘(과 그 반대)에서 구역과 줄이 같은 자리에서 이어져 바뀐다.
 * - 브라우저가 지원하지 않거나 「동작 줄이기」가 켜져 있으면 지금처럼 즉시 바뀐다.
 * - 도는 동안만 <html class="tz-vt"> 를 붙인다(구역 높이가 바뀌는 전환은 tz-vt-zone 도). 전환 이름(구역·줄)과 길이·곡선은 그 클래스 아래에만 걸려 있어
 *   (dashboard-task-zone.css) 다른 화면에는 영향이 없고, 페이지 전체(root)는 전환에서 빠져 깜빡이지 않는다.
 * - 연타하면 돌던 전환은 건너뛰고(skipTransition) 새 전환을 시작한다. 건너뛴 전환의 상태 변경은 그대로 적용된다.
 */
import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "@/components/motion/useMotion";

export const ZONE_TRANSITION_CLASS = "tz-vt";
/** 구역 상자까지 찍는 전환(펼침/접기 · 0건 접힘). 칩·단계 필터는 줄만 찍는다 — 구역이 살아 있어야 칩 표시가 미끄러지는 게 보인다. */
export const ZONE_TRANSITION_BOX_CLASS = "tz-vt-zone";
export interface ZoneTransitionOptions { /** 구역 상자도 함께 잇는다. */ box?: boolean; /** 옛 화면을 찍기 직전에 할 일. */ before?: () => void }
/** 줄 이름을 붙이는 최대 줄 수 — 접힌 목록(PC 6줄)만큼만. 36건을 펼쳐도 찍는 줄 수가 늘지 않는다. */
export const NAMED_ROWS = 6;

type Transition = { finished: Promise<unknown>; ready?: Promise<unknown>; skipTransition: () => void };
type Starter = (update: () => void) => Transition;

/** item.key(한글·기호 포함)를 겹치지 않는 CSS 식별자로 — 안전한 글자만 남기고 나머지는 _코드값_ 으로 바꾼다(1:1). */
export function followUpTransitionName(key: string): string {
  return "tz-row-" + [...key].map(ch => /[a-zA-Z0-9-]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`).join("");
}

export function useZoneTransition(): (update: () => void, options?: ZoneTransitionOptions) => void {
  const running = useRef<Transition | null>(null);
  useEffect(() => () => {
    running.current?.skipTransition();
    running.current = null;
    document.documentElement.classList.remove(ZONE_TRANSITION_CLASS, ZONE_TRANSITION_BOX_CLASS);
  }, []);
  return useCallback((update, { box = false, before } = {}) => {
    const start = (document as Document & { startViewTransition?: Starter }).startViewTransition;
    if (typeof start !== "function" || prefersReducedMotion()) { update(); return; }
    running.current?.skipTransition();
    before?.();
    const root = document.documentElement;
    root.classList.add(ZONE_TRANSITION_CLASS);
    root.classList.toggle(ZONE_TRANSITION_BOX_CLASS, box);
    let transition: Transition;
    try { transition = start.call(document, () => { flushSync(update); }); }
    catch { root.classList.remove(ZONE_TRANSITION_CLASS, ZONE_TRANSITION_BOX_CLASS); update(); return; }
    running.current = transition;
    const settle = () => { if (running.current === transition) { running.current = null; root.classList.remove(ZONE_TRANSITION_CLASS, ZONE_TRANSITION_BOX_CLASS); } };
    transition.ready?.catch(() => { /* 건너뛴 전환 — 상태는 이미 바뀌었다 */ });
    transition.finished.then(settle, settle);
  }, []);
}
