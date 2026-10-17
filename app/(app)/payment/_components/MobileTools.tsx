"use client";

import { useEffect, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode, type PointerEvent, type KeyboardEvent } from "react";
import { WORK_MANUAL_URL } from "@/config/links";
import CompanySearchBar from "./CompanySearchBar";
import DriveLinkBar from "./DriveLinkBar";
import "./mobile-tools.css";

type Tool = "drive" | "manual" | "news" | "search";
type Props = Omit<ComponentProps<typeof CompanySearchBar>, "compact" | "inputRef"> & { onNews: () => void };

function Icon({ kind }: { kind: Tool }) {
  const paths = {
    drive: "M3 7h7l2 3h9v10H3z M3 7V4h7l2 3",
    manual: "M12 5v15 M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z",
    news: "M4 4h16v16H4z M7 8h10 M7 12h4 M7 16h10 M14 11h3v3h-3z",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={paths[kind]} /></svg>;
}

/** 표시·활성화만 담당. 검색/DirtyGuard/Drive 연결의 기존 소유 경로를 호출한다. */
export default function MobileTools({ onNews, ...search }: Props) {
  const [active, setActive] = useState<Tool | null>(null);
  const [searchEditing, setSearchEditing] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pointerKind = useRef<string | null>(null);
  const armedAtDown = useRef(false);
  const suppressFocus = useRef(false);
  const close = () => { setActive(null); setSearchEditing(false); };

  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) { setActive(null); setSearchEditing(false); }
    };
    document.addEventListener("pointerdown", outside);
    const keyboard = () => { pointerKind.current = null; };
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard, true); };
  }, []);
  useEffect(() => { if (searchEditing) input.current?.focus(); }, [searchEditing]);

  function tool(kind: Tool, label: string, options: { href?: string; action?: () => void; external?: boolean; panelOpen?: boolean } = {}): ReactNode {
    const expanded = active === kind;
    const execute = (event: MouseEvent<HTMLElement>) => {
      if (kind === "search") { event.preventDefault(); setActive(kind); setSearchEditing(true); return; }
      const actualMouse = pointerKind.current === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      const keyboardClick = event.detail === 0 && pointerKind.current === null;
      if (!keyboardClick && !actualMouse && !armedAtDown.current) {
        event.preventDefault(); setActive(kind); setSearchEditing(false); return;
      }
      if (options.action) { event.preventDefault(); options.action(); }
    };
    const attrs = {
      "data-payment-tool": kind,
      "data-expanded": expanded,
      "data-query-active": kind === "search" && search.value.trim() !== "",
      "aria-label": label,
      "aria-expanded": options.panelOpen ?? expanded,
      title: label,
      className: `payment-glass-tool payment-glass-${kind}${expanded ? " is-expanded" : ""}`,
      onPointerDown: (event: PointerEvent<HTMLElement>) => { pointerKind.current = event.pointerType; armedAtDown.current = active === kind; },
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) { setActive(kind); setSearchEditing(false); }
      },
      onFocus: () => { if (suppressFocus.current) { suppressFocus.current = false; return; } if (pointerKind.current === null) setActive(kind); },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        pointerKind.current = null;
        if (event.key === " " && options.href) { event.preventDefault(); event.currentTarget.click(); }
      },
      onClick: execute,
    };
    const content = <><Icon kind={kind} /><span className="payment-tool-label" aria-hidden>{label}</span></>;
    return options.href ? <a {...attrs} href={options.href} target={options.external ? "_blank" : undefined} rel={options.external ? "noopener noreferrer" : undefined}>{content}</a> : <button {...attrs} type="button">{content}</button>;
  }

  return <div ref={host} className="payment-mobile-tools" role="group" aria-label="실무 도구" onKeyDown={(event) => {
    if (event.key === "Tab") pointerKind.current = null;
    if (event.key === "Escape") {
      event.preventDefault();
      // 검색어는 닫아도 유지한다. 초기화는 입력 옆 X만 담당한다.
      if (searchEditing) { setSearchEditing(false); suppressFocus.current = true; requestAnimationFrame(() => host.current?.querySelector<HTMLElement>('[data-payment-tool="search"]')?.focus()); }
      setActive(null);
    }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <DriveLinkBar mobileExpanded={active === "drive"} renderTrigger={(drive) => tool("drive", drive.label, { href: drive.linked ? drive.href : undefined, external: drive.linked, action: drive.linked ? undefined : drive.togglePanel, panelOpen: drive.panelOpen })} />
    {tool("manual", "업무매뉴얼 보기", { href: WORK_MANUAL_URL, external: true })}
    {tool("news", "정책자금 뉴스", { action: onNews })}
    {searchEditing ? <div className="payment-glass-search-editor"><CompanySearchBar {...search} compact inputRef={input} /></div> : tool("search", search.value.trim() ? `업체 검색: ${search.value}` : "업체 검색")}
  </div>;
}
