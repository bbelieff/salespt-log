/**
 * 최상단 층(top layer) 창 공용 도구 (2026-11-12 app-dialog-unify-2).
 *
 * 네이티브 <dialog>.showModal() 창은 브라우저의 「최상단 층」에 뜬다. 그 위로는 document.body 에 붙인
 * 포털 팝업(z-index 와 상관없이)이 올라오지 못해 가려지고 눌리지 않는다.
 * - PortalTargetContext / usePortalTarget: 열린 창 안에서는 포털을 body 대신 그 <dialog> 안에 그린다.
 *   창 밖에서는 지금처럼 document.body.
 * - useTopLayerDialog: 창을 모달로 열고(뒤 화면 inert·스크롤 잠금), 첫 초점·닫힌 뒤 초점 복귀,
 *   Esc(cancel)·브라우저가 강제로 닫은 경우를 한곳에서 처리한다. AppDialog·DbDetail·통화 정리 확인이 쓴다.
 *   초점이 창 안에 포털로 띄운 팝업(본판 밖)에 있으면 Esc 는 그 팝업 몫 — 바깥 창은 닫지 않는다.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import "./top-layer.css";

export const PortalTargetContext = createContext<HTMLElement | null>(null);

/** 포털을 그릴 곳 — 열린 최상단 층 창 안이면 그 <dialog>, 아니면 document.body(서버 렌더링 중엔 null). */
export function usePortalTarget(): HTMLElement | null {
  const target = useContext(PortalTargetContext);
  if (target) return target;
  return typeof document === "undefined" ? null : document.body;
}

/** 네이티브 dialog 가 없는 환경(구형 브라우저·jsdom)에서는 open 속성만 바꾼다. */
export function openModal(el: HTMLDialogElement) {
  if (typeof el.showModal === "function") el.showModal();
  else el.setAttribute("open", "");
}
export function closeModal(el: HTMLDialogElement) {
  if (typeof el.close === "function") el.close();
  else el.removeAttribute("open");
}

/** 초점이 창 안이지만 본판(panel) 밖 — 창 안에 포털로 띄운 팝업에 있다. */
export function focusInPortalPopup(dialog: HTMLElement, panel: HTMLElement | null): boolean {
  const active = typeof document === "undefined" ? null : document.activeElement;
  return !!active && !!panel && active !== dialog && dialog.contains(active) && !panel.contains(active);
}

export interface TopLayerDialogOptions {
  /** 닫기 요청(Esc·강제 닫힘). 닫을지(적던 내용 확인 등)는 부르는 쪽이 정한다. */
  requestClose: () => void;
  /** 열린 직후 초점 줄 곳. 없으면 브라우저 기본(showModal 의 첫 초점). */
  initialFocus?: (dialog: HTMLDialogElement) => HTMLElement | null | undefined;
}

export function useTopLayerDialog<P extends HTMLElement = HTMLElement>({ requestClose, initialFocus }: TopLayerDialogOptions) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<P>(null);
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  const requestRef = useRef(requestClose);
  requestRef.current = requestClose;
  const focusRef = useRef(initialFocus);
  focusRef.current = initialFocus;
  const unmounting = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    unmounting.current = false;
    const previous = document.activeElement as HTMLElement | null;
    // 뒤 화면 스크롤 잠금(서랍을 밀 때 뒤 목록이 같이 밀리지 않게) — 닫으면 원래 값으로.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!el.open) openModal(el);
    setHost(el);
    focusRef.current?.(el)?.focus({ preventScroll: true });
    return () => {
      unmounting.current = true;
      if (el.open) closeModal(el);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // React 는 cancel·close 를 React 트리 위로 올려 보낸다 — 안에 겹친 창의 이벤트는 무시(그 창이 스스로 처리).
  const onCancel = useCallback((e: SyntheticEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    if (focusInPortalPopup(e.currentTarget, panelRef.current)) return;
    requestRef.current();
  }, []);

  const onClose = useCallback((e: SyntheticEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    // 브라우저가 Esc 를 막지 못하고 닫아 버린 경우: 다시 열어 두고 평소 닫기를 탄다
    // (안 닫기로 하거나 가드 확인창이 뜨면 창이 그대로 보여야 한다).
    const el = ref.current;
    if (unmounting.current || !el) return;
    if (!el.open) openModal(el);
    if (focusInPortalPopup(el, panelRef.current)) return;
    requestRef.current();
  }, []);

  return { ref, panelRef, host, onCancel, onClose };
}
