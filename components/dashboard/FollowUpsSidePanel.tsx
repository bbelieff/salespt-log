"use client";
/**
 * 할 일 구역 오른쪽 열(폰은 목록 아래) — 「단계 · 종류 · 이유」 보기 전환(2026-11-25 belie).
 * 한 번에 한 기준만 보이고, 줄을 누르면 목록이 그 조건으로 좁혀진다(다시 누르면 풀림). 보기를 바꾸면 고른 조건은 풀린다 —
 * 그래서 좁히는 방법은 늘 둘(급한 정도 칩 + 이 열 하나)이다.
 * - 단계: 사이드 탭과 같은 STEP 배지를 세로 흐름으로. 건수·급한 정도 막대(길이 = 건수 비례)·가장 오래 밀린 날수. 가장 많이 몰린 단계에 「몰림」.
 *   STEP 1 DB생산은 흐름을 끊지 않으려고 흐리게 둔다 — 「오늘 챙길 일」로 세지 않고 주간 목표에서 본다.
 * - 종류·이유: lib/analytics/follow-up-work-kind 의 분류. 이유는 한 줄에 둘일 수 있어 합계가 전체보다 클 수 있다.
 */
import type { ReactNode } from "react";
import StepBadge from "@/components/ui/StepBadge";
import type { FollowUpItem, FollowUpStep } from "@/lib/analytics/dashboard-follow-ups";
import { countFollowUpReasons, followUpReasonLabels, followUpWorkKind, FOLLOW_UP_WORK_KINDS, FOLLOW_UP_WORK_KIND_LABEL, type FollowUpWorkKind } from "@/lib/analytics/follow-up-work-kind";
import { useSlidingThumb } from "@/components/motion/useSlidingThumb";
import { FOLLOW_UP_STEP_LABEL, WORK_KIND_ICON } from "./FollowUpRow";

export type SideView = "step" | "kind" | "reason";
export type SidePick = { view: SideView; key: string };
export const SIDE_VIEWS: ReadonlyArray<{ id: SideView; label: string }> = [{ id: "step", label: "단계" }, { id: "kind", label: "종류" }, { id: "reason", label: "이유" }];
const STEPS: FollowUpStep[] = ["2", "3", "4"];
const GROUPS = ["long-overdue", "overdue", "today"] as const;
/** 「몰림」은 건수가 혼자 가장 많고 이 이상일 때만 — 두세 건짜리 목록에서 괜히 뜨지 않게. */
const CROWDED_MIN = 3;

export function sidePickMatches(item: FollowUpItem, pick: SidePick | null): boolean {
  if (!pick) return true;
  if (pick.view === "step") return item.step === pick.key;
  if (pick.view === "kind") return followUpWorkKind(item) === pick.key;
  return followUpReasonLabels(item).includes(pick.key);
}
export function sidePickLabel(pick: SidePick): string {
  if (pick.view === "step") return FOLLOW_UP_STEP_LABEL[pick.key as FollowUpStep] ?? pick.key;
  if (pick.view === "kind") return FOLLOW_UP_WORK_KIND_LABEL[pick.key as FollowUpWorkKind] ?? pick.key;
  return pick.key;
}

export default function FollowUpsSidePanel({ urgent, incomplete, view, pick, onView, onPick, children }: {
  /** 예정을 뺀 남은 일(급한 순). */
  urgent: readonly FollowUpItem[];
  incomplete: boolean;
  view: SideView;
  pick: SidePick | null;
  onView: (view: SideView) => void;
  onPick: (pick: SidePick) => void;
  /** 세는 기준 · 예정된 일. */
  children?: ReactNode;
}) {
  const thumb = useSlidingThumb();
  const num = (n: number) => incomplete && !n ? "—" : String(n);
  const on = (v: SideView, key: string) => pick?.view === v && pick.key === key;
  const perStep = STEPS.map(step => {
    const list = urgent.filter(i => i.step === step);
    const oldest = list.reduce((max, i) => Math.max(max, i.overdueDays ?? 0), 0);
    return { step, list, oldest, long: list.filter(i => i.group === "long-overdue").length };
  });
  const most = Math.max(0, ...perStep.map(s => s.list.length));
  const crowded = most >= CROWDED_MIN && perStep.filter(s => s.list.length === most).length === 1 ? perStep.find(s => s.list.length === most)!.step : null;
  const kinds = FOLLOW_UP_WORK_KINDS.map(kind => ({ kind, count: urgent.filter(i => followUpWorkKind(i) === kind).length })).filter(k => k.count > 0);
  const reasons = countFollowUpReasons(urgent);
  const top = Math.max(1, ...kinds.map(k => k.count), ...reasons.map(r => r.count));

  return <div className="tz-aside">
    <div className="tz-views" role="group" aria-label="오른쪽 열 보기">
      <span ref={thumb.thumb} className="slide-thumb" data-tone="paper" data-on={thumb.on ? "" : undefined} style={thumb.style} aria-hidden />
      {SIDE_VIEWS.map(v => <button key={v.id} type="button" className="tz-view" aria-pressed={view === v.id} onClick={() => onView(v.id)}>{v.label}</button>)}
    </div>

    {view === "step" && <div className="tz-flow" role="group" aria-label="단계별로 보기">
      <div className="tz-step-off"><StepBadge step="1" aria-hidden /><span className="tz-step-name">DB생산</span><small>주간 목표에서</small></div>
      {perStep.map(({ step, list, oldest, long }) => {
        const n = list.length;
        return <button key={step} type="button" className="tz-step" data-crowded={crowded === step || undefined} aria-pressed={on("step", step)}
          aria-label={`STEP ${step} ${FOLLOW_UP_STEP_LABEL[step]} ${incomplete && !n ? "확인 필요" : `${n}건`}${crowded === step ? " · 가장 많이 몰림" : ""}`} onClick={() => onPick({ view: "step", key: step })}>
          <StepBadge step={step} aria-hidden /><span className="tz-step-name">{FOLLOW_UP_STEP_LABEL[step]}{crowded === step && <em className="tz-crowded">몰림</em>}</span><strong>{num(n)}</strong>
          <span className="tz-mini" aria-hidden style={{ width: n ? `${Math.max(14, Math.round(n / most * 100))}%` : undefined }}>{GROUPS.map(g => <i key={g} data-seg={g} style={{ flexGrow: list.filter(i => i.group === g).length }} />)}</span>
          {n > 0 && <small>{oldest > 0 ? `가장 오래 D+${String(oldest).padStart(2, "0")}` : "모두 오늘 할 일"}{long > 0 ? ` · 7일 넘게 밀림 ${long}` : ""}</small>}
        </button>;
      })}
    </div>}

    {view === "kind" && <div className="tz-picks" role="group" aria-label="할 일 종류로 보기">
      {kinds.map(({ kind, count }) => {
        const Icon = WORK_KIND_ICON[kind];
        return <button key={kind} type="button" className="tz-pick" aria-pressed={on("kind", kind)} aria-label={`${FOLLOW_UP_WORK_KIND_LABEL[kind]} ${count}건`} onClick={() => onPick({ view: "kind", key: kind })}>
          <Icon size={14} aria-hidden /><span className="tz-step-name">{FOLLOW_UP_WORK_KIND_LABEL[kind]}</span><strong>{count}</strong>
          <span className="tz-meter" aria-hidden><i style={{ width: `${Math.round(count / top * 100)}%` }} /></span>
        </button>;
      })}
      {!kinds.length && <p className="tz-side-note">{incomplete ? "불러오지 못한 항목이 있어 아직 알 수 없습니다." : "남은 일이 없어요."}</p>}
    </div>}

    {view === "reason" && <div className="tz-picks" role="group" aria-label="이유로 보기">
      {reasons.map(({ label, count }) => <button key={label} type="button" className="tz-pick" data-plain aria-pressed={on("reason", label)} aria-label={`${label} ${count}건`} onClick={() => onPick({ view: "reason", key: label })}>
        <span className="tz-step-name">{label}</span><strong>{count}</strong>
        <span className="tz-meter" aria-hidden><i style={{ width: `${Math.round(count / top * 100)}%` }} /></span>
      </button>)}
      {reasons.length > 0 ? <p className="tz-side-note">한 줄에 이유가 둘일 수 있어 합계가 남은 건수보다 클 수 있습니다.</p>
        : <p className="tz-side-note">{incomplete ? "불러오지 못한 항목이 있어 아직 알 수 없습니다." : "따로 적힌 이유가 없어요."}</p>}
    </div>}
    {children}
  </div>;
}
