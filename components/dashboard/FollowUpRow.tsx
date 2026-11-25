"use client";
/**
 * 할 일 구역의 한 줄 — 밀린 날수 배지 · 업체명(줄바꿈) · 해야 할 일 · 「STEP n 단계 · 기준일 · 기관」 · 「열기」.
 * 줄 하나가 컴포넌트 하나이고 key 는 item.key 로 고정이다 — 이어지는 전환(useZoneTransition)이 줄마다 고유 이름으로 자리를 잇는다.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight } from "lucide-react";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { followUpBadgeLabel, type FollowUpItem, type FollowUpStep } from "@/lib/analytics/dashboard-follow-ups";

export const FOLLOW_UP_STEP_LABEL: Record<FollowUpStep, string> = { "2": "DB관리", "3": "일정·계약", "4": "실무/수납" };

export default function FollowUpRow({ item, primary, expanded, onToggle, transitionName }: {
  item: FollowUpItem;
  /** 목록 맨 윗줄만 주 버튼. */
  primary: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** 이어지는 전환용 고유 이름(useZoneTransition) — 화면에 그려진 앞쪽 줄에만 준다. 전환이 도는 동안에만 CSS 가 쓴다. */
  transitionName?: string;
}) {
  const context = item.facts.find(f => /기관/.test(f.label))?.value ?? item.facts.find(f => /상태/.test(f.label))?.value;
  const due = item.dueISO ? `기준일 ${item.dueISO.slice(5).replace("-", ".")}` : "날짜 확인";
  return <li className="tz-row" data-group={item.group} data-expanded={expanded} style={transitionName ? { "--tz-vt-name": transitionName } as CSSProperties : undefined}>
    <span className="ft-badge" data-tone={item.group}>{followUpBadgeLabel(item.badge)}</span>
    <button type="button" className="tz-what" aria-expanded={expanded} aria-label={`${item.company} · ${item.action} 상세`} onClick={onToggle}>
      <span className="tz-what-text">
        <span className="tz-title"><strong>{item.company}</strong> <span>· {item.action}</span></span>
        <small>STEP {item.step} {FOLLOW_UP_STEP_LABEL[item.step]} · {due}{context ? ` · ${context}` : ""}</small>
      </span>
      <DisclosureChevron open={expanded} />
    </button>
    <Link href={item.href as Route} className={primary ? "tz-go btn-depth-blue" : "tz-go"} aria-label={`${item.company} ${item.action} 열기`}>열기<ArrowUpRight size={13} aria-hidden /></Link>
    {expanded && <div className="tz-detail">
      <p>{item.reasons.join(" · ")}</p>
      {item.detail && <p>{item.detail}</p>}
      <dl>
        <div><dt>기준일</dt><dd>{item.dueISO ?? "날짜 확인"}</dd></div>
        {item.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      </dl>
    </div>}
  </li>;
}
