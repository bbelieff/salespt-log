"use client";
/**
 * 「오늘 챙길 일」 할 일 구역(2026-11-24 개편, belie 승인 기획서 1단계) — 화면 폭 전체.
 * 누르지 않아도 가장 급한 일이 줄로 보인다: 「N건 남았어요」 → 비율 막대 → 급한 정도 칩 → 줄 목록(PC 6줄·폰 3줄, 그 자리에서 펼침)
 * | 오른쪽 열(FollowUpsSidePanel — 단계·종류·이유 보기 전환, 누르면 목록이 좁혀짐) · 세는 기준 · 예정된 일. 세는 규칙·정렬은 lib/analytics/dashboard-follow-ups 그대로.
 * 밀린 일이 있으면 무지개 테두리(data-emphasis=flow · .ft-glow)를 유지한다. 조회·재시도·집계는 DashboardFollowUps 책임.
 * 움직임(belie 2026-11-24 추가 지시, 이 둘만): ① 이어지는 전환 — 펼침/접기 · 칩·단계로 좁히기 · 0건으로 접힘(useZoneTransition)
 * ② 선택 바탕이 옮겨 가는 칩(useSlidingThumb). 나머지는 이미 쓰는 fx-*(막대 차오름·0건 달성 체크)만.
 */
import DisclosureChevron from '@/components/ui/DisclosureChevron';
import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, CircleAlert, Plus } from "lucide-react";
import { compareFollowUpUrgency, hasOverdueFollowUps, type FollowUpGroup, type FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
import "@/components/dashboard/dashboard-follow-ups.css";
import "./followups-table.css";
import "./dashboard-task-zone.css";
import FollowUpRow from "./FollowUpRow";
import FollowUpsSidePanel, { SIDE_VIEWS, sidePickLabel, sidePickMatches, type SidePick, type SideView } from "./FollowUpsSidePanel";
import FollowUpsDetailPanel from "./FollowUpsDetailPanel";
import { useFollowUpsPopover } from "./useFollowUpsPopover";
import { useHandledToday } from "./useHandledToday";
import { followUpTransitionName, NAMED_ROWS, useZoneTransition } from "./useZoneTransition";
import { usePlayOnOpen } from "@/components/motion/useMotion";
import { useSlidingThumb } from "@/components/motion/useSlidingThumb";
import "@/components/motion/sliding-thumb.css";

/** 오른쪽 열에서 마지막으로 본 보기(단계·종류·이유)를 이 기기에 기억한다. */
export const SIDE_VIEW_KEY = "followups-side-view";
const GROUPS = [{ id: "long-overdue", label: "7일 넘게 밀림" }, { id: "overdue", label: "밀림" }, { id: "today", label: "오늘" }] as const;
type GroupFilter = "all" | "long-overdue" | "overdue" | "today" | "unknown";
/** 접힌 목록의 줄 수 — PC 6줄. 폰(1024 미만)은 CSS 가 3줄까지만 보인다(dashboard-task-zone.css). */
const PC_ROWS = 6;
const PHONE_ROWS = 3;
/** 남은 일이 이보다 많으면 「5건만 먼저」 안내로 바꾼다. */
const MANY = 15;
type Popover = { step: string; group: FollowUpGroup | "all" | "step" };
const hasUrgent = (list: readonly FollowUpItem[]) => list.some(i => i.group !== "upcoming");

export default function DashboardFollowUpsView({ items: latest, notice, incomplete = false, firstRun = false, todayISO, handledScope }: {
  items: FollowUpItem[];
  notice?: ReactNode;
  incomplete?: boolean;
  /** 계약·할 일·미팅·DB 기록이 하나도 없는 계정 — DB 등록 안내. */
  firstRun?: boolean;
  /** 주면 이 기기에서 「오늘 N건 처리」를 센다(useHandledToday). */
  todayISO?: string;
  /** 「오늘 N건 처리」를 계정별로 가르는 표시(해시해서만 저장). */
  handledScope?: string;
}) {
  const [group, setGroup] = useState<GroupFilter>("all");
  const [view, setView] = useState<SideView>("step");
  const [pick, setPick] = useState<SidePick | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [popover, setPopover] = useState<Popover | null>(null);
  const id = useId();
  const pop = useFollowUpsPopover(popover, setPopover, () => {});
  const transition = useZoneTransition();
  const chipThumb = useSlidingThumb();
  const play = usePlayOnOpen("task-zone-bar");
  const list = useRef<HTMLUListElement>(null);
  // 화면에 그리는 목록은 조회 결과를 그대로 따르되, 「남은 일 있음 ↔ 0건」으로 구역 모양이 바뀌는 순간만
  // 전환 안에서 바꾼다(옛 화면을 먼저 찍어야 이어진다). achieved = 이 화면을 연 뒤 0건이 된 순간(체크 한 번 톡).
  const [items, setItems] = useState(latest);
  const [achieved, setAchieved] = useState(false);
  const folds = latest !== items && hasUrgent(latest) !== hasUrgent(items);
  if (latest !== items && !folds) {
    // 좁혀 둔 조건(칩·단계)에 맞던 일이 조회가 바뀌면서 하나도 안 남았으면 조건을 풀어 남은 일을 보여 준다.
    // 사용자가 직접 0건짜리 조건을 고른 경우(바뀌기 전에도 0건)는 그대로 둔다.
    const matches = (list: readonly FollowUpItem[]) => list.filter(i => i.group !== "upcoming" && (group === "all" || i.group === group) && sidePickMatches(i, pick)).length;
    if ((group !== "all" || pick !== null) && hasUrgent(latest) && matches(items) > 0 && matches(latest) === 0) { setGroup("all"); setPick(null); setOpen(false); setDetail(null); }
    setItems(latest);
  }
  useEffect(() => {
    if (folds) transition(() => { setItems(latest); setAchieved(!hasUrgent(latest)); }, { box: true });
  }, [folds, latest, transition]);

  const urgent = items.filter(i => i.group !== "upcoming").sort(compareFollowUpUrgency);
  const upcoming = items.filter(i => i.group === "upcoming").sort(compareFollowUpUrgency);
  const unknown = urgent.filter(i => i.group === "unknown").length;
  const done = useHandledToday(todayISO, urgent.length, !incomplete, handledScope);
  const shown = urgent.filter(i => (group === "all" || i.group === group) && sidePickMatches(i, pick));
  // 마지막으로 본 보기를 되살린다(저장소를 못 쓰면 「단계」 그대로).
  useEffect(() => {
    try { const saved = localStorage.getItem(SIDE_VIEW_KEY); if (SIDE_VIEWS.some(v => v.id === saved)) setView(saved as SideView); } catch { /* 기억 못 해도 화면은 그대로 */ }
  }, []);
  const emphasis = hasOverdueFollowUps(items);
  const num = (n: number) => incomplete && !n ? "—" : String(n);
  // 필터를 바꾸면 목록은 다시 접힌 첫 줄부터. 칩·단계는 다시 누르면 풀린다.
  // 펼친 목록을 스크롤해 둔 채 바꾸면 화면 밖 줄이 날아들므로, 전환 전에 목록을 맨 위로 돌린다.
  const rewind = () => { if (list.current) list.current.scrollTop = 0; };
  const refold = () => { setOpen(false); setDetail(null); };
  const pickGroup = (key: GroupFilter) => transition(() => { setGroup(current => current === key ? "all" : key); refold(); }, { before: rewind });
  const pickSide = (next: SidePick | null) => transition(() => { setPick(current => next && current?.view === next.view && current.key === next.key ? null : next); refold(); }, { before: rewind });
  const switchView = (next: SideView) => {
    if (next === view) return;
    try { localStorage.setItem(SIDE_VIEW_KEY, next); } catch { /* 기억 못 해도 전환은 된다 */ }
    transition(() => { setView(next); setPick(null); refold(); }, { before: rewind });
  };

  const shell = (state: string, body: ReactNode) => <section data-dashboard-follow-ups data-state={state} data-emphasis={emphasis ? "flow" : undefined} ref={pop.card} className="follow-ups-card ft-card tz-zone" aria-label="오늘 챙길 일">
    {emphasis && <span aria-hidden className="ft-glow" />}
    {body}
    {rules && <div className="follow-ups-guide"><p>첫 연락·미팅 결과는 당일 처리. 다음 날부터 「밀림」, 7일째부터 「7일 넘게 밀림」으로 셉니다.</p><p>기관·다음 할 일 누락은 진행건별 한 번, 등록된 투두는 각각 셉니다. 시작일을 모르면 날짜 확인으로 표시합니다. DB생산은 주간목표에서 확인합니다.</p></div>}
    {notice}
    {popover && <FollowUpsDetailPanel id={id} items={upcoming} incomplete={incomplete} panelRef={pop.panel} position={pop.position} onClose={pop.close} onPointerEnter={pop.cancelClose} onPointerLeave={pop.leave} />}
  </section>;
  const rulesButton = <button type="button" className="tz-rules" onClick={() => setRules(!rules)} aria-expanded={rules}>세는 기준 {rules ? "닫기" : "보기"}</button>;
  const upcomingProps = { "data-upcoming-trigger": true, "aria-haspopup": "dialog" as const, "aria-expanded": popover !== null, "aria-controls": popover ? id : undefined, onClick: (e: React.MouseEvent<HTMLButtonElement>) => pop.open(e.currentTarget, "", "upcoming", true) };

  // 조회가 실패해 확인된 일이 하나도 없으면 0건·완료로 보이지 않게 한다.
  if (!urgent.length && incomplete) return shell("unconfirmed", <div className="tz-state">
    <span className="tz-state-icon" data-tone="unknown" aria-hidden><CircleAlert size={20} /></span>
    <div><h2>오늘 챙길 일 <b className="tz-unconfirmed">확인 필요</b></h2><p>불러오지 못한 항목이 있어 남은 건수를 아직 알 수 없습니다. 아래 「다시 시도」를 눌러 주세요.</p></div>
    {rulesButton}
  </div>);

  if (!urgent.length && firstRun) return shell("first", <div className="tz-state">
    <span className="tz-state-icon" data-tone="first" aria-hidden><Plus size={20} /></span>
    <div><h2>아직 챙길 일이 없어요</h2><p>DB를 등록하면 첫 연락할 업체가 여기에 나타납니다. 매일 이 칸을 0건으로 만드는 것이 목표예요.</p></div>
    <Link href={"/db-sheet" as Route} className="tz-go btn-depth-blue">DB 등록하기</Link>
  </div>);

  if (!urgent.length) return shell("done", <div className="tz-state">
    <span className="tz-state-icon" data-tone="done" aria-hidden><Check size={20} className={achieved ? "fx-check-pop" : undefined} /></span>
    <div><h2>오늘 챙길 일을 모두 끝냈어요</h2><p>{done > 0 ? `오늘 ${done}건을 처리했습니다. ` : ""}{upcoming.length ? `7일 안에 예정된 일이 ${upcoming.length}건 있어요.` : "7일 안에 예정된 일도 없습니다."}</p></div>
    {rulesButton}
    {upcoming.length > 0 && <button type="button" className="tz-go" {...upcomingProps}>예정된 일 보기</button>}
  </div>);

  const count = (g: FollowUpGroup) => urgent.filter(i => i.group === g).length;
  const chip = (key: GroupFilter, label: string, n: number) => <button key={key} type="button" className="tz-chip" data-tone={key} aria-pressed={group === key} onClick={() => pickGroup(key)}>
    {key !== "all" && <i aria-hidden />}{label} <b>{num(n)}</b>
  </button>;
  const filtered = group !== "all" || pick !== null;
  return shell("list", <div className="tz-grid">
    <div className="tz-main">
      <div className="tz-head">
        <h2>오늘 챙길 일</h2>
        <p className="tz-count">{incomplete && <span className="tz-count-pre">확인된 </span>}<strong>{urgent.length}</strong><span>건 남았어요</span></p>
        <p className="tz-hint">0건이 되면 오늘 챙길 일은 끝입니다. {urgent.length > MANY ? "밀린 일이 많을 땐 위에서부터 5건만 먼저 끝내 보세요." : "가장 급한 일이 맨 위에 있어요."}</p>
      </div>
      <div className="tz-bar" role="img" aria-label={`${done > 0 ? `오늘 처리 ${done}건, ` : ""}남은 일 ${urgent.length}건 — 7일 넘게 밀림 ${count("long-overdue")}건, 밀림 ${count("overdue")}건, 오늘 ${count("today")}건`}>
        <span className={play ? "tz-bar-fill fx-grow-x" : "tz-bar-fill"}>
          <i data-seg="done" style={{ flexGrow: done }} />
          {GROUPS.map(g => <i key={g.id} data-seg={g.id} style={{ flexGrow: count(g.id) }} />)}
          <i data-seg="unknown" style={{ flexGrow: unknown }} />
        </span>
      </div>
      <div className="tz-chips" role="group" aria-label="급한 정도로 좁혀 보기">
        <span ref={chipThumb.thumb} className="slide-thumb" data-tone="ink" data-on={chipThumb.on ? "" : undefined} style={chipThumb.style} aria-hidden />
        {chip("all", "전체", urgent.length)}
        {GROUPS.map(g => chip(g.id, g.label, count(g.id)))}
        {unknown > 0 && chip("unknown", "날짜 확인", unknown)}
        {done > 0 && <span className="tz-done"><Check size={13} strokeWidth={2.6} aria-hidden />오늘 {done}건 처리</span>}
      </div>
      {pick && <p className="tz-picked"><span>{sidePickLabel(pick)}만 보는 중</span><button type="button" onClick={() => pickSide(null)}>풀기</button></p>}
      <ul ref={list} className="tz-list" data-open={open}>
        {(open ? shown : shown.slice(0, PC_ROWS)).map((item, index) => <FollowUpRow key={item.key} item={item} primary={index === 0} expanded={detail === item.key} onToggle={() => setDetail(detail === item.key ? null : item.key)}
          transitionName={index < NAMED_ROWS ? followUpTransitionName(item.key) : undefined} />)}
        {!shown.length && <li className="tz-row tz-row-empty"><span /><p><strong>이 조건에 해당하는 일이 없어요</strong><small>위의 「전체」를 누르면 남은 일을 모두 볼 수 있습니다.</small></p></li>}
      </ul>
      {shown.length > PHONE_ROWS && <button type="button" className="tz-more" data-pc-hidden={shown.length <= PC_ROWS} aria-expanded={open} onClick={() => transition(() => setOpen(current => !current), { box: true, before: rewind })}>
        {open ? "접기" : `${filtered ? "해당" : "남은"} ${shown.length}건 모두 보기`} <DisclosureChevron open={open} />
      </button>}
    </div>
    <FollowUpsSidePanel urgent={urgent} incomplete={incomplete} view={view} pick={pick} onView={switchView} onPick={pickSide}>
      {rulesButton}
      <button type="button" className="tz-upcoming" {...upcomingProps}><span>예정된 일 · 7일 안</span><b>{incomplete && !upcoming.length ? "—" : `${upcoming.length}건`} <DisclosureChevron open={popover !== null} /></b></button>
    </FollowUpsSidePanel>
  </div>);
}
