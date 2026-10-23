"use client";
/** Compact stage summary with an urgency-sorted, actionable table. */
import DisclosureChevron from '@/components/ui/DisclosureChevron';
import React, { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import {ArrowUpRight,X} from "lucide-react";
import { compareFollowUpUrgency, followUpBadgeLabel, hasOverdueFollowUps, type FollowUpItem, type FollowUpGroup } from "@/lib/analytics/dashboard-follow-ups";
import "@/components/dashboard/dashboard-follow-ups.css";
import "./followups-table.css";
import { useFollowUpsPopover } from "./useFollowUpsPopover";
const steps = [{ id: "1.5", label: "DB관리시트" }, { id: "2", label: "컨택관리" }, { id: "3", label: "일정·계약" }, { id: "4", label: "실무/수납" }];
const groups = [{ id: "long-overdue", label: "장기누락" }, { id: "overdue", label: "경과" }, { id: "today", label: "오늘" }] as const;
type Selection = {
    step: string;
    group: FollowUpGroup | "all" | "step";
};
export default function DashboardFollowUpsView({ items, notice, incomplete = false }: {
    items: FollowUpItem[];
    notice?: ReactNode;
    incomplete?: boolean;
}) {
    const [active, setActive] = useState<Selection | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [rules, setRules] = useState(false);
    const id = useId();
    const { card, panel, position, connector, open, close, hover, leave, cancelClose } = useFollowUpsPopover(active, setActive, () => setExpanded(null));
    const filtered = items.filter(item => active?.group === "all" ? item.group !== "upcoming" : active?.group === "step" ? item.step === active.step && item.group !== "upcoming" : item.group === active?.group && (active.group === "upcoming" || !active.step || item.step === active.step)).sort(compareFollowUpUrgency);
    const now = items.filter(i => i.group !== "upcoming").length;
    const tone = active && groups.some(g => g.id === active.group) ? active.group : "today";
    const source = active?.group === "all" ? "전체 처리목록" : active?.group === "upcoming" ? "예정된 일 · 7일 안" : active?.group === "unknown" ? "날짜 확인" : `STEP ${active?.step} ${steps.find(s => s.id === active?.step)?.label ?? ""}`;
    const selectionLabel = active?.group === "step" ? "전체" : groups.find(g => g.id === active?.group)?.label;
    const countLabel = incomplete && !filtered.length ? "확인 필요" : `${incomplete ? "확인된 " : ""}${filtered.length}건`;
    const sourceTrail = `오늘 챙길 일 › ${source}${selectionLabel ? ` › ${selectionLabel}` : ""} ${countLabel}`;
    const heading = active?.group === "all" ? "전체 처리목록" : active?.group === "upcoming" ? "예정된 일" : active?.group === "unknown" ? "날짜 확인" : `${steps.find(s => s.id === active?.step)?.label ?? ""} · ${selectionLabel}`;
    return <section data-dashboard-follow-ups data-selection-tone={tone} data-emphasis={hasOverdueFollowUps(items) ? "flow" : undefined} ref={card} className="follow-ups-card ft-card" aria-label="오늘 챙길 일">
  <header><h2>오늘 챙길 일 <button type="button" className="follow-ups-total" aria-label={`전체 처리목록 ${incomplete&&!now?"확인 필요":`${now}건`}`} aria-expanded={active?.group === "all"} aria-controls={active?.group === "all" ? id : undefined} onClick={e => open(e.currentTarget, "", "all", true)} aria-haspopup="dialog">{incomplete && !now ? "확인 필요" : `${incomplete ? "확인된 " : ""}${now}건`} <DisclosureChevron open={active?.group === "all"} /></button></h2><button type="button" className="follow-ups-help" onClick={() => setRules(!rules)} aria-expanded={rules}>기준</button></header>
  <div className="ft-summary" role="table" aria-label="STEP별 미처리 건수">
   <div className="ft-summary-head" role="row"><span role="columnheader">단계</span>{groups.map(g => <span role="columnheader" key={g.id} data-tone={g.id}>{g.label}</span>)}</div>
   {steps.map(step => {
            const count = items.filter(i => i.step === step.id && i.group !== "upcoming").length;
            return <div role="row" className="ft-summary-row" key={step.id} data-active={active?.step === step.id} onPointerEnter={e => { if (e.pointerType === "mouse")
                hover(e.currentTarget, step.id); }} onPointerLeave={e => { if (e.pointerType === "mouse")
                leave(); }}>
    <div role="cell"><button type="button" className="ft-step" onClick={e => open(e.currentTarget, step.id, "step", true)} aria-haspopup="dialog" aria-expanded={active?.step === step.id && active.group === "step"} aria-controls={active?.step === step.id && active.group === "step" ? id : undefined} aria-label={`STEP ${step.id} ${step.label} 전체 ${incomplete && !count ? "확인 필요" : `${count}건`}`}><span className="ft-step-id">{step.id}</span><span>{step.label}</span></button></div>
    {groups.map(g => { const n = items.filter(i => i.step === step.id && i.group === g.id).length; return <div role="cell" key={g.id}><button type="button" data-tone={g.id} data-zero={!n} className="ft-count" onClick={e => { e.stopPropagation(); open(e.currentTarget, step.id, g.id, true); }} aria-haspopup="dialog" aria-expanded={active?.step === step.id && active.group === g.id} aria-controls={active?.step === step.id && active.group === g.id ? id : undefined} aria-label={`STEP ${step.id} ${step.label} ${g.label} ${incomplete && !n ? "확인 필요" : `${n}건`}`}>{incomplete && !n ? "—" : n}</button></div>; })}
   </div>;
        })}
  </div>
  {items.some(i => i.group === "unknown") && <button type="button" className="ft-unknown" aria-haspopup="dialog" aria-expanded={active?.group === "unknown"} data-tone="unknown" onClick={e => open(e.currentTarget, "", "unknown", true)}>날짜 확인 {items.filter(i => i.group === "unknown").length}건</button>}
  <button type="button" className="follow-ups-upcoming ft-upcoming" aria-haspopup="dialog" aria-expanded={active?.group === "upcoming"} onClick={e => open(e.currentTarget, "", "upcoming", true)}><span>예정된 일 <small>7일 안</small></span><b>{incomplete && !items.some(i => i.group === "upcoming") ? "—" : `${items.filter(i => i.group === "upcoming").length}건`} <DisclosureChevron open={active?.group === "upcoming"} /></b></button>
  {rules && <div className="follow-ups-guide"><p>첫 연락·미팅 결과는 당일 처리. 다음 날부터 경과, 7일부터 장기누락.</p><p>기관·다음 할 일 누락은 진행건별 한 번, 등록된 투두는 각각 셉니다. 시작일을 모르면 날짜 확인으로 표시합니다. DB생산은 주간목표에서 확인합니다.</p></div>}{notice}
  {active && connector && createPortal(<svg aria-hidden className="ft-source-connector" data-selection-tone={tone} style={{ left: connector.left, top: connector.top, width: connector.width, height: connector.height }} viewBox={`0 0 ${connector.width} ${connector.height}`}><path d={`M 0 ${connector.sourceY} H ${connector.width / 2} V ${connector.targetY} H ${connector.width}`}/><circle cx="1" cy={connector.sourceY} r="2.5"/></svg>, document.body)}
  {active && createPortal(<div ref={panel} id={id} className="ft-panel" data-selection-tone={tone} style={position} role="dialog" aria-label={sourceTrail} tabIndex={-1} onPointerEnter={cancelClose} onPointerLeave={e => { if (e.pointerType === "mouse")
            leave(); }}>
   <div className="ft-panel-head"><div><h3 className="ft-source-title">{heading} <b>{countLabel}</b><small>{active.group === "upcoming" ? "가까운 일정순 · 7일 안" : "긴급순"}</small></h3></div><button type="button" onClick={() => close()} aria-label="목록 닫기"><X size={17}/></button></div>
   <div className="ft-scroll"><table className="ft-table"><colgroup><col className="ft-col-urgency"/><col className="ft-col-company"/><col /><col className="ft-col-context"/><col className="ft-col-link"/></colgroup><thead><tr><th>긴급도</th><th>업체 · 진행건</th><th>해야 할 일</th><th>기준일 · 기관</th><th>바로가기</th></tr></thead><tbody>
    {filtered.map(item => { const progress = item.facts.find(f => /진행건|^진행$/.test(f.label))?.value; const context = item.facts.find(f => /기관/.test(f.label))?.value ?? item.facts.find(f => /상태/.test(f.label))?.value ?? "—"; return <React.Fragment key={item.key}><tr data-expanded={expanded === item.key}><td><span className="ft-badge" data-tone={item.group}>{followUpBadgeLabel(item.badge)}</span></td><td><div className="ft-company-inline"><strong title={item.company}>{item.company}</strong>{progress && <small title={`진행 ${progress}`}>진행 {progress}</small>}{active.group === "all" && <small>STEP {item.step}</small>}</div></td><td><button type="button" className="ft-action" title={item.action} aria-label={`${item.company} · ${item.action} 상세`} aria-expanded={expanded === item.key} onClick={() => setExpanded(expanded === item.key ? null : item.key)}><span>{item.action}</span><DisclosureChevron open={expanded === item.key} /></button></td><td className="ft-context"><span title={`${item.dueISO ?? "날짜 확인"} · ${context}`}>{item.dueISO?.replaceAll("-", ".") ?? "날짜 확인"} · {context}</span></td><td><Link href={item.href as Route} className="ft-go" aria-label={`${item.company} ${item.action} 바로가기`} onClick={() => close(false)}>열기<ArrowUpRight size={13}/></Link></td></tr>
     {expanded === item.key && <tr className="ft-expanded"><td colSpan={5}><p>{item.reasons.join(" · ")}</p>{item.detail && <p>{item.detail}</p>}<dl><div><dt>업체</dt><dd>{item.company}</dd></div><div><dt>해야 할 일</dt><dd>{item.action}</dd></div><div><dt>기준일</dt><dd>{item.dueISO ?? "날짜 확인"}</dd></div>{item.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl></td></tr>}
    </React.Fragment>; })}
   </tbody></table>{!filtered.length && <div className="ft-empty"><span aria-hidden>{incomplete ? "!" : "✓"}</span><strong>{incomplete ? "아직 확인하지 못한 항목이 있어요" : "지금 처리할 일이 없어요"}</strong><p>{incomplete ? "일부 조회에 실패했어요. 다시 시도한 뒤 확인해 주세요." : "선택한 목록은 0건입니다."}</p></div>}</div>
  </div>, document.body)}
 </section>;
}
