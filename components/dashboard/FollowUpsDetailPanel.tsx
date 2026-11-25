"use client";
/**
 * 「예정된 일 · 7일 안」 목록 창 — 할 일 구역 개편(2026-11-24) 전부터 쓰던 긴급도 표(.ft-panel)를 그대로 옮겼다.
 * 지금 챙길 일은 구역 안 줄 목록(FollowUpRow)으로 보이고, 이 창은 아직 날짜가 오지 않은 일만 연다.
 * 위치·닫기는 useFollowUpsPopover, body 포털이라 구역의 무지개 테두리 층과 섞이지 않는다.
 */
import React, { useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, X } from "lucide-react";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { followUpBadgeLabel, type FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";

export default function FollowUpsDetailPanel({ id, items, incomplete, panelRef, position, onClose, onPointerEnter, onPointerLeave }: {
  id: string;
  items: FollowUpItem[];
  incomplete: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  /** restoreFocus=false 는 「열기」로 떠날 때. */
  onClose: (restoreFocus?: boolean) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const countLabel = incomplete && !items.length ? "확인 필요" : `${incomplete ? "확인된 " : ""}${items.length}건`;
  return createPortal(<div ref={panelRef} id={id} className="ft-panel" data-selection-tone="today" style={position} role="dialog" aria-label={`오늘 챙길 일 › 예정된 일 · 7일 안 ${countLabel}`} tabIndex={-1} onPointerEnter={onPointerEnter} onPointerLeave={e => { if (e.pointerType === "mouse") onPointerLeave(); }}>
    <div className="ft-panel-head"><div><h3 className="ft-source-title">예정된 일 <b>{countLabel}</b><small>가까운 일정순 · 7일 안</small></h3></div><button type="button" onClick={() => onClose()} aria-label="목록 닫기"><X size={17} /></button></div>
    <div className="ft-scroll"><table className="ft-table"><colgroup><col className="ft-col-urgency" /><col className="ft-col-company" /><col /><col className="ft-col-context" /><col className="ft-col-link" /></colgroup><thead><tr><th>긴급도</th><th>업체 · 진행건</th><th>해야 할 일</th><th>기준일 · 기관</th><th>바로가기</th></tr></thead><tbody>
      {items.map(item => {
        const progress = item.facts.find(f => /진행건|^진행$/.test(f.label))?.value;
        const context = item.facts.find(f => /기관/.test(f.label))?.value ?? item.facts.find(f => /상태/.test(f.label))?.value ?? "—";
        return <React.Fragment key={item.key}><tr data-expanded={expanded === item.key}><td><span className="ft-badge" data-tone={item.group}>{followUpBadgeLabel(item.badge)}</span></td><td><div className="ft-company-inline"><strong title={item.company}>{item.company}</strong>{progress && <small title={`진행 ${progress}`}>진행 {progress}</small>}<small>STEP {item.step}</small></div></td><td><button type="button" className="ft-action" title={item.action} aria-label={`${item.company} · ${item.action} 상세`} aria-expanded={expanded === item.key} onClick={() => setExpanded(expanded === item.key ? null : item.key)}><span className="ft-action-text"><span>{item.action}</span><small className="ft-action-sub">{item.dueISO?.slice(5).replace("-", ".") ?? "날짜 확인"} · {context}</small></span><DisclosureChevron open={expanded === item.key} /></button></td><td className="ft-context"><span title={`${item.dueISO ?? "날짜 확인"} · ${context}`}>{item.dueISO?.replaceAll("-", ".") ?? "날짜 확인"} · {context}</span></td><td><Link href={item.href as Route} className="ft-go" aria-label={`${item.company} ${item.action} 바로가기`} onClick={() => onClose(false)}>열기<ArrowUpRight size={13} /></Link></td></tr>
          {expanded === item.key && <tr className="ft-expanded"><td colSpan={5}><p>{item.reasons.join(" · ")}</p>{item.detail && <p>{item.detail}</p>}<dl><div><dt>업체</dt><dd>{item.company}</dd></div><div><dt>해야 할 일</dt><dd>{item.action}</dd></div><div><dt>기준일</dt><dd>{item.dueISO ?? "날짜 확인"}</dd></div>{item.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl></td></tr>}
        </React.Fragment>;
      })}
    </tbody></table>{!items.length && <div className="ft-empty"><span aria-hidden>{incomplete ? "!" : "✓"}</span><strong>{incomplete ? "아직 확인하지 못한 항목이 있어요" : "7일 안에 예정된 일이 없어요"}</strong><p>{incomplete ? "일부 조회에 실패했어요. 다시 시도한 뒤 확인해 주세요." : "예정된 일은 0건입니다."}</p></div>}</div>
  </div>, document.body);
}
