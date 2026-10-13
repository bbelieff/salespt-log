"use client";

/**
 * DashboardFollowUps — 대시보드 「오늘 챙길 일」 카드(생산성 카드와 전체 진행건 사이).
 * 밀린·오늘 할 일, 결과를 안 적은 지난 미팅, 다시 연락할 DB, 다음 할 일 없이 멈춘 업체를 칩으로 세고,
 * 칩을 누르면 목록이 열린다(휴대폰: 카드 안 / PC: 카드 위로 뜸, 위쪽 공간이 모자라면 아래로).
 * 목록 한 줄을 누르면 그 화면의 그 업체·미팅·DB로 바로 간다. 계산은 lib/analytics/dashboard-follow-ups.ts.
 * SSOT: docs/design/components.md §9 DashboardFollowUps.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { useMonthsMeetings } from "@/query/contact-hooks";
import { isDbSheetUnsupported, useDbSheetLeads } from "@/query/db-sheet-hooks";
import {
  FOLLOW_UP_KINDS,
  STALL_DAYS,
  UPCOMING_DAYS,
  meetingLookbackMonths,
  summarizeFollowUps,
  type FollowUpItem,
  type FollowUpKind,
} from "@/lib/analytics/dashboard-follow-ups";

/** 보조 조회 신선도 — useDashboard 와 같은 5분. 저장하면 무효화로 바로 갱신된다. */
const DASHBOARD_STALE_MS = 5 * 60_000;
const PC_MEDIA = "(min-width: 1024px)";
/** PC 떠 있는 목록: 최대 max-h-64(256px), 위쪽 공간이 이보다 모자라면 아래로 편다. */
const LIST_MAX_PX = 256;
const LIST_MIN_PX = 160;
const GAP_PX = 8;

interface KindStyle {
  label: string;
  /** 도착 화면 탭 색(tokens.md 탭 단계색): 실무/수납 rose · 일정·계약 violet · DB blue. */
  dot: string;
  count: string;
  head: (n: number) => string;
  badge: string;
  aux?: boolean;
}

const KIND: Record<FollowUpKind, KindStyle> = {
  overdue: { label: "밀린 할 일", dot: "bg-rose-600", count: "text-red-600", head: (n) => `밀린 할 일 ${n}건`, badge: "bg-red-50 text-red-700" },
  today: { label: "오늘 할 일", dot: "bg-rose-600", count: "text-slate-900", head: (n) => `오늘 할 일 ${n}건`, badge: "bg-blue-50 text-blue-700" },
  meeting: { label: "미팅 결과", dot: "bg-violet-600", count: "text-slate-900", head: (n) => `결과를 안 적은 미팅 ${n}건`, badge: "bg-amber-100 text-amber-700" },
  recontact: { label: "다시 연락", dot: "bg-blue-700", count: "text-slate-900", head: (n) => `다시 연락할 DB ${n}곳`, badge: "bg-slate-100 text-slate-700" },
  stalled: { label: "멈춘 업체", dot: "bg-rose-600", count: "text-slate-900", head: (n) => `다음 할 일 없이 ${STALL_DAYS}일 이상 멈춘 업체 ${n}곳`, badge: "bg-slate-100 text-slate-700" },
  upcoming: { label: `${UPCOMING_DAYS}일 안 할 일`, dot: "bg-slate-300", count: "text-slate-600", head: (n) => `${UPCOMING_DAYS}일 안에 할 일 ${n}건`, badge: "bg-slate-100 text-slate-600", aux: true },
};

type Placement = { side: "above" | "below"; maxHeight: number } | null;

/** 화면 위쪽을 덮는 고정 머리(헤더·페이지 배너·대시보드 진행바)의 아래 끝 y. */
function coveredTop(): number {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>(".sticky, .fixed").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < window.innerHeight / 2 && r.top <= bottom + 1 && r.bottom > bottom) bottom = r.bottom;
  });
  return bottom;
}

/** PC 에서만 잰다 — 위쪽 공간이 모자라면(sticky 진행바 밑으로 잘림) 아래로 펴고 높이를 남은 공간에 맞춘다. */
function measurePlacement(card: HTMLElement | null): Placement {
  if (!card || typeof window === "undefined" || !window.matchMedia?.(PC_MEDIA).matches) return null;
  const top = coveredTop();
  let rect = card.getBoundingClientRect();
  if (rect.top < top + GAP_PX) {
    window.scrollBy({ top: rect.top - top - GAP_PX }); // 카드 윗부분이 진행바 밑에 숨어 있으면 먼저 꺼낸다
    rect = card.getBoundingClientRect();
  }
  const above = rect.top - top - GAP_PX;
  if (above >= LIST_MIN_PX) return { side: "above", maxHeight: Math.min(LIST_MAX_PX, above) };
  const below = window.innerHeight - rect.bottom - GAP_PX;
  return { side: "below", maxHeight: Math.min(LIST_MAX_PX, Math.max(LIST_MIN_PX, below)) };
}

const FRAME = "relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm";

export default function DashboardFollowUps({ todayISO }: { todayISO: string }) {
  const contracts = useContractPayments();
  const todos = useAllTodos();
  // 계약·할 일이 끝난 뒤에 보조 조회(월 미팅 1~3회·DB관리시트)를 시작한다 — 첫 화면 조회 몰림 완화.
  const primaryDone = !contracts.isPending && !todos.isPending;
  const months = useMemo(() => meetingLookbackMonths(todayISO), [todayISO]);
  const meetings = useMonthsMeetings(months, { enabled: primaryDone, staleTime: DASHBOARD_STALE_MS });
  const leads = useDbSheetLeads({ enabled: primaryDone, staleTime: DASHBOARD_STALE_MS, background: true });
  const dbHidden = isDbSheetUnsupported(leads.error); // 이 계정은 DB관리시트를 쓰지 않음 — 칩만 조용히 숨긴다
  const dbFailed = leads.isError && !dbHidden;
  const workFailed = contracts.isError || todos.isError;

  const summary = useMemo(() => summarizeFollowUps({
    contracts: workFailed ? undefined : contracts.data?.rows ?? [],
    todos: workFailed ? undefined : todos.data?.todos ?? [],
    meetings: meetings.meetings,
    leads: leads.data ? leads.data.leads ?? [] : undefined,
  }, todayISO), [workFailed, contracts.data, todos.data, meetings.meetings, leads.data, todayISO]);

  const [open, setOpen] = useState<FollowUpKind | null>(null);
  const [placement, setPlacement] = useState<Placement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const chipRefs = useRef<Partial<Record<FollowUpKind, HTMLButtonElement | null>>>({});
  const listId = useId();
  const openKind = open && summary.counts[open] > 0 ? open : null;

  useEffect(() => {
    if (!openKind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      chipRefs.current[openKind]?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openKind]);

  const toggle = (kind: FollowUpKind) => {
    if (openKind === kind) { setOpen(null); return; }
    setPlacement(measurePlacement(cardRef.current));
    setOpen(kind);
  };

  const loading = contracts.isPending || todos.isPending || meetings.isPending || leads.isPending;
  if (loading) {
    return (
      <section data-dashboard-follow-ups aria-label="오늘 챙길 일" aria-busy="true" className={`${FRAME} z-20`}>
        <div className="fx-skeleton h-4 w-40 rounded-md" />
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="fx-skeleton h-11 w-20 rounded-full pc:h-6 pc:w-16" />)}
        </div>
      </section>
    );
  }

  const failures = { work: workFailed, meetings: meetings.isError, db: dbFailed };
  const anyFailure = failures.work || failures.meetings || failures.db;
  const allFailed = failures.work && failures.meetings && (failures.db || dbHidden);
  const retry = () => {
    if (contracts.isError) void contracts.refetch();
    if (todos.isError) void todos.refetch();
    meetings.refetchFailed();
    if (dbFailed) void leads.refetch();
  };

  if (allFailed) {
    return (
      <section data-dashboard-follow-ups aria-label="오늘 챙길 일" className={`${FRAME} z-20`}>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>오늘 챙길 일을 불러오지 못했어요.</span>
          <button type="button" onClick={retry} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-blue-700">다시 시도</button>
        </div>
      </section>
    );
  }

  const chips = FOLLOW_UP_KINDS.filter((kind) => summary.counts[kind] > 0);
  const quiet = summary.total === 0 && !anyFailure;
  const listSide = openKind && placement ? placement.side : "above";
  const listStyle: CSSProperties | undefined = openKind && placement ? { maxHeight: placement.maxHeight } : undefined;

  return (
    <section
      ref={cardRef}
      data-dashboard-follow-ups
      aria-label="오늘 챙길 일"
      className={`${FRAME} ${openKind && listSide === "below" ? "z-20 pc:z-30" : "z-20"}`}
    >
      {quiet ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-slate-700">{summary.headline}</p>
          {summary.counts.upcoming > 0 && <Chip kind="upcoming" count={summary.counts.upcoming} open={openKind === "upcoming"} listId={listId} chipRef={(el) => { chipRefs.current.upcoming = el; }} onToggle={toggle} />}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="whitespace-nowrap text-xs text-slate-800">오늘 챙길 일</strong>
            {/* 일부 조회가 실패했는데 셀 것이 0이면 「0건」이라고 단정하지 않는다. */}
            {summary.total > 0 && <b className="whitespace-nowrap text-base tabular-nums text-slate-950">{summary.total}건</b>}
            {summary.total > 0 && <span className="text-xs text-slate-600">{summary.headline}</span>}
          </div>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 pc:gap-2">
              {chips.map((kind) => (
                <Chip key={kind} kind={kind} count={summary.counts[kind]} open={openKind === kind} listId={listId} chipRef={(el) => { chipRefs.current[kind] = el; }} onToggle={toggle} />
              ))}
            </div>
          )}
        </>
      )}
      {openKind && (
        <div
          id={listId}
          role="region"
          aria-label={KIND[openKind].head(summary.counts[openKind])}
          data-follow-ups-list={listSide}
          style={listStyle}
          className={`mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 pc:absolute pc:inset-x-0 pc:z-10 pc:shadow-2xl ${listSide === "above" ? "pc:bottom-full pc:mb-2 pc:mt-0" : "pc:top-full"}`}
        >
          <p className="px-2 py-1.5 text-xs font-bold text-slate-700">{KIND[openKind].head(summary.counts[openKind])}</p>
          <ul>
            {summary.groups[openKind].map((item) => <Row key={item.key} item={item} badge={KIND[openKind].badge} />)}
          </ul>
        </div>
      )}
      {summary.unlinkedTodos > 0 && (
        <p className="mt-2 text-px-11 text-slate-500">업체 연결이 끊긴 할 일 {summary.unlinkedTodos}건은 빼고 셌어요 · 캘린더에서 정리해 주세요</p>
      )}
      {anyFailure && (
        <p className="mt-1 flex items-center gap-2 text-px-11 text-slate-500" role="status">
          <span>일부 항목을 불러오지 못했어요</span>
          <button type="button" onClick={retry} className="min-h-11 px-1 font-semibold text-blue-700 pc:min-h-0">다시 시도</button>
        </p>
      )}
    </section>
  );
}

interface ChipProps {
  kind: FollowUpKind;
  count: number;
  open: boolean;
  listId: string;
  chipRef: (el: HTMLButtonElement | null) => void;
  onToggle: (kind: FollowUpKind) => void;
}

function Chip({ kind, count, open, listId, chipRef, onToggle }: ChipProps) {
  const style = KIND[kind];
  const tone = style.aux ? "border-dashed text-slate-500" : "text-slate-700";
  return (
    <button
      ref={chipRef}
      type="button"
      data-follow-up-chip={kind}
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      onClick={() => onToggle(kind)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold hover:bg-slate-50 aria-expanded:border-slate-800 pc:min-h-0 pc:px-3 pc:py-1 ${tone}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
      <b className={`tabular-nums ${style.count}`}>{count}</b>
    </button>
  );
}

function Row({ item, badge }: { item: FollowUpItem; badge: string }) {
  return (
    <li>
      <Link href={item.href as Route} className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-blue-50 pc:min-h-0 pc:py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-800">{item.title}</span>
          {item.detail && <span className="block truncate text-px-11 text-slate-500">{item.detail}</span>}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-px-11 font-bold tabular-nums ${badge}`}>{item.badge}</span>
      </Link>
    </li>
  );
}
