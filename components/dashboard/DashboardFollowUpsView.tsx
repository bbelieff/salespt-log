"use client";
/** Compact step summary; the number opens its complete actionable detail list. */
import React, { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { compareFollowUpUrgency, type FollowUpItem, type FollowUpGroup } from "@/lib/analytics/dashboard-follow-ups";
import "./dashboard-follow-ups.css";

type Group = FollowUpGroup;
type SelectionGroup = Group | "all";
const groups: { id: Exclude<Group, "upcoming" | "unknown">; label: string; range: string }[] = [
  { id: "long-overdue", label: "장기누락", range: "7일~" },
  { id: "overdue", label: "경과", range: "1~6일" },
  { id: "today", label: "오늘", range: "오늘" },
];
const steps = [
  { id: "1.5", label: "DB관리시트", supported: true },
  { id: "2", label: "컨택관리", supported: true },
  { id: "3", label: "일정·계약", supported: true },
  { id: "4", label: "실무/수납", supported: true },
];
export default function DashboardFollowUpsView({ items, notice, incomplete = false }: { items: FollowUpItem[]; notice?: ReactNode; incomplete?: boolean }) {
  const [active, setActive] = useState<{ step: string; group: SelectionGroup } | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const [position, setPosition] = useState({ left: 12, top: 12 });
  function togglePanel(button: HTMLButtonElement, step: string, group: SelectionGroup) {
    anchorRef.current = button;
    setActive(previous => previous?.step === step && previous.group === group ? null : { step, group });
  }
  function closePanel() {
    setActive(null);
    anchorRef.current?.focus({ preventScroll: true });
  }
  const [rules, setRules] = useState(false);
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const left = Math.max(12, Math.min(anchor.x + anchor.width / 2 - panel.width / 2, window.innerWidth - panel.width - 12));
      const below = anchor.bottom + 8;
      const preferredTop = below + panel.height <= window.innerHeight - 12 ? below : anchor.top - panel.height - 8;
      const top = Math.max(12, Math.min(preferredTop, window.innerHeight - panel.height - 12));
      setPosition({ left, top });
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    panelRef.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!panelRef.current?.contains(node) && !anchorRef.current?.contains(node)) setActive(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActive(null);
        anchorRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [active]);
  const filtered = items.filter(item => active?.group === "all"
    ? item.group !== "upcoming"
    : item.group === active?.group && (active.group === "upcoming" || item.step === active.step))
    .sort(compareFollowUpUrgency);
  const selectionLabel = active?.group === "all" ? "전체 처리목록"
    : active?.group === "upcoming" ? "7일 안의 예정된 일"
    : `STEP ${active?.step} ${steps.find(step => step.id === active?.step)?.label ?? ""} · ${active?.group === "unknown" ? "날짜 확인" : groups.find(group => group.id === active?.group)?.label ?? ""}`;
  const now = items.filter(item => item.group !== "upcoming").length;
  return <section data-dashboard-follow-ups className="follow-ups-card" aria-label="오늘 챙길 일">
    <header><h2>오늘 챙길 일 {(!incomplete || now > 0) && <button type="button" className="follow-ups-total" aria-label={`전체 처리목록 ${now}건`} aria-haspopup="dialog" aria-expanded={active?.group === "all"} aria-controls={active?.group === "all" ? panelId : undefined} onClick={event => togglePanel(event.currentTarget, "", "all")}>{incomplete ? "확인된 " : ""}{now}건 <span aria-hidden>›</span></button>}</h2><button type="button" className="follow-ups-help" onClick={() => setRules(!rules)} aria-expanded={rules}>기준</button></header>
    <div className="follow-ups-steps" aria-label="STEP별 미처리 건수">
      {steps.filter(step => step.supported && items.some(item => item.step === step.id && item.group !== "upcoming")).map(step => <div className="follow-ups-step-row" key={step.id}>
        <h3>STEP {step.id} · {step.label}</h3>
        <div className="follow-ups-counts">{groups.map(group => {
          const count = items.filter(item => item.step === step.id && item.group === group.id).length;
          if (!count) return null;
          const selected = active?.step === step.id && active.group === group.id;
          return <button key={group.id} type="button" data-tone={group.id} title={`${group.label} · ${group.range}`} aria-label={`STEP ${step.id} ${step.label} ${group.label} ${count}건`} aria-expanded={selected} aria-haspopup="dialog" aria-controls={selected ? panelId : undefined} onClick={event => togglePanel(event.currentTarget, step.id, group.id)}><i aria-hidden />{group.label} <b>{count}</b></button>;
        })}{items.some(item => item.step === step.id && item.group === "unknown") && <button type="button" data-tone="unknown" aria-haspopup="dialog" aria-expanded={active?.step === step.id && active.group === "unknown"} onClick={event => togglePanel(event.currentTarget, step.id, "unknown")}>날짜 확인 <b>{items.filter(item => item.step === step.id && item.group === "unknown").length}</b></button>}</div>
      </div>)}
      {now === 0 && !incomplete && <p className="follow-ups-empty">지금 챙길 일이 없습니다.</p>}
    </div>
    {items.some(item => item.group === "upcoming") && <button type="button" className="follow-ups-upcoming" aria-expanded={active?.group === "upcoming"} aria-haspopup="dialog" aria-controls={active?.group === "upcoming" ? panelId : undefined} onClick={event => togglePanel(event.currentTarget, "", "upcoming")}>예정된 일 <span>7일 안</span><b>{items.filter(item => item.group === "upcoming").length}</b><span aria-hidden>{active?.group === "upcoming" ? "⌃" : "⌄"}</span></button>}
    {active && createPortal(<div ref={panelRef} id={panelId} tabIndex={-1} style={position} className="follow-ups-panel" role="dialog" aria-label={selectionLabel}>
    <div className="follow-ups-panel-head"><p><strong>{selectionLabel} · {filtered.length}건</strong><span>{active.group === "upcoming" ? "일정이 가까운 순" : "처리기한이 오래된 순"}</span></p><button type="button" onClick={closePanel} aria-label="목록 닫기">닫기</button></div>
    {filtered.length === 0 ? <p className="follow-ups-empty">지금 챙길 일이 없습니다.</p> : <ul className="follow-ups-list">
      {filtered.map(item => <li key={item.key} className="follow-ups-detail">
        <div className="follow-ups-line"><span className="follow-ups-step">STEP {item.step} · {steps.find(step => step.id === item.step)?.label}</span><b className="follow-ups-badge" data-tone={item.group}>{item.badge}</b></div>
        <h3>{item.company}</h3>
        <p className="follow-ups-detail-action">{item.action}</p>
        <p className="follow-ups-reason">{item.reasons.join(" · ")}</p>
        <dl>{item.facts.map(({label, value}) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <Link className="follow-ups-detail-link" href={item.href as Route} onClick={() => setActive(null)}>{item.action} 화면 열기<span aria-hidden> →</span></Link>
      </li>)}
    </ul>}
    </div>, document.body)}
    {rules && <div className="follow-ups-guide">
      <p><b>첫 연락</b> 유입 당일 · 다음 날부터 경과</p>
      <p><b>미팅 결과</b> 당일 입력 · 다음 날부터 경과</p>
      <p><b>진행건</b> 기관·투두가 없으면 바로 처리 대상. 1~6일 경과, 7일부터 장기누락.</p>
      <p>기관·다음 할 일 누락은 진행건별 한 번만 셉니다. 등록된 투두는 각각 셉니다. 시작일을 확인할 수 없는 건은 날짜 확인으로 표시합니다. DB생산은 주간목표에서 확인합니다.</p>
    </div>}
    {notice}

  </section>;
}
