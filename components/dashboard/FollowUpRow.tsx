"use client";
/**
 * 할 일 구역의 한 줄 — 밀린 날수 배지 · (PC) 종류 칩 · 업체명(줄바꿈) · 해야 할 일 · 「STEP n 단계 · 기준일 · 기관」 · (넓은 PC) 이유 칩 · 「열기」.
 * 줄 하나가 컴포넌트 하나이고 key 는 item.key 로 고정이다 — 이어지는 전환(useZoneTransition)이 줄마다 고유 이름으로 자리를 잇는다.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRightCircle, ArrowUpRight, CalendarDays, PencilLine, Phone, SquareCheck, Users, type LucideIcon } from "lucide-react";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { followUpBadgeLabel, type FollowUpItem, type FollowUpStep } from "@/lib/analytics/dashboard-follow-ups";
import { followUpReasonChips, followUpWorkKind, FOLLOW_UP_WORK_KIND_LABEL, type FollowUpWorkKind } from "@/lib/analytics/follow-up-work-kind";

export const FOLLOW_UP_STEP_LABEL: Record<FollowUpStep, string> = { "2": "DB관리", "3": "일정·계약", "4": "실무/수납" };
/** 종류 칩·오른쪽 열 「종류」 보기가 같이 쓰는 아이콘. */
export const WORK_KIND_ICON: Record<FollowUpWorkKind, LucideIcon> = { call: Phone, date: CalendarDays, meeting: Users, record: PencilLine, plan: ArrowRightCircle, todo: SquareCheck };

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
  const kind = followUpWorkKind(item), KindIcon = WORK_KIND_ICON[kind], chips = followUpReasonChips(item);
  const due = item.dueISO ? `기준일 ${item.dueISO.slice(5).replace("-", ".")}` : "날짜 확인";
  return <li className="tz-row" data-group={item.group} data-expanded={expanded} style={transitionName ? { "--tz-vt-name": transitionName } as CSSProperties : undefined}>
    <span className="ft-badge" data-tone={item.group}>{followUpBadgeLabel(item.badge)}</span>
    {/* 종류 칩 — PC 에서만(폰 줄은 이미 세 줄 높이). 색 없이 아이콘 + 두세 글자, 같은 폭이라 세로로 훑는다. */}
    <span className="tz-kind" data-kind={kind}><KindIcon size={13} aria-hidden />{FOLLOW_UP_WORK_KIND_LABEL[kind]}</span>
    <button type="button" className="tz-what" aria-expanded={expanded} aria-label={`${item.company} · ${item.action} 상세`} onClick={onToggle}>
      <span className="tz-what-text">
        <span className="tz-title"><strong>{item.company}</strong> <span>· {item.action}</span></span>
        <small><span className="tz-meta-step">STEP {item.step} {FOLLOW_UP_STEP_LABEL[item.step]} · </span>{due}{context ? ` · ${context}` : ""}</small>
      </span>
      <DisclosureChevron open={expanded} />
    </button>
    {/* 이유 칩 — 넓은 PC 에서만, 최대 두 개. 좁으면 빠지고 줄을 펼치면 전부 보인다. */}
    {chips.length > 0 && <span className="tz-reasons" aria-label="이 일이 생긴 이유">{chips.map(chip => <span key={chip}>{chip}</span>)}</span>}
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
