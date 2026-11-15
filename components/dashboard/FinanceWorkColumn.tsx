"use client";

/**
 * FinanceWorkColumn — 대시보드 맨 위 띠의 네 번째 칸 「진행건」과 칸 아래 미리보기 두 줄(A안, belie 2026-11-13).
 *
 * SSOT: docs/design/components.md §9-2. PC(1024~)에만 보인다(`hidden pc:flex`) — 폰은 지금처럼 세 칸 + 아래 진행건 판.
 * 칸을 누르면 다른 칸과 같이 그 칸 바로 아래에 상세가 열리고, 상세는 실무/수납과 같은 `WorkStatusBar`(상태별 목록 팝업)다.
 * 자료는 `useDashboardWorkItems`(DashboardWorkStatus) — 아래 진행건 판과 같은 조회라 새 요청이 없다.
 */
import type { CSSProperties, ReactNode, RefObject } from "react";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import SkeletonBars from "@/components/ui/SkeletonBars";
import WorkStatusBar, { STATUS } from "@/components/payment/WorkStatusBar";
import type { WorkStatusItem } from "@/lib/analytics/payment-work-status";

export interface WorkColumnData {
  /** null = 아직 불러오는 중. */
  items: WorkStatusItem[] | null;
  failed: boolean;
  onRetry: () => void;
  onNavigate: (row: number | null, slot: number) => void;
}

/** 칸 아래 늘 보이는 미리보기(PC 만) — [이름, 값] 또는 글 한 줄. 잘라 숨기지 않고 좁으면 줄을 바꾼다. */
export function FinancePreview({ rows }: { rows: Array<[string, ReactNode?]> }) {
  return (
    <span data-finance-preview className="mt-0.5 hidden w-full flex-col gap-0.5 text-xs font-normal leading-snug text-slate-500 pc:flex">
      {rows.map(([label, value]) => (
        <span key={label} className="flex flex-wrap items-baseline justify-between gap-x-2 tabular-nums">
          <span>{label}</span>
          {value !== undefined && <span>{value}</span>}
        </span>
      ))}
    </span>
  );
}

/** 상태별 건수를 두 줄로 — 0건 상태는 빼고 실무/수납 막대와 같은 순서(예 「진행 9 · 수납완료 1」 / 「장기관리 6」). */
export function workPreviewLines(items: WorkStatusItem[]): string[] {
  const parts = STATUS
    .map((s) => [s.label, items.filter((item) => item.status === s.key).length] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}`);
  if (parts.length === 0) return ["진행건 없음"];
  const half = Math.ceil(parts.length / 2);
  return [parts.slice(0, half).join(" · "), parts.slice(half).join(" · ")].filter(Boolean);
}

interface ColumnProps {
  work: WorkColumnData;
  open: boolean;
  onToggle: () => void;
  className: string;
  style: CSSProperties;
  amountStyle: CSSProperties;
  amountRef: RefObject<HTMLSpanElement | null>;
  detail: ReactNode;
}

export default function FinanceWorkColumn({ work, open, onToggle, className, style, amountStyle, amountRef, detail }: ColumnProps) {
  const lines = work.failed ? ["불러오지 못했어요"] : work.items ? workPreviewLines(work.items) : [];
  return (
    <div data-finance-work-column className="hidden min-w-0 flex-col pc:flex">
      <button
        type="button"
        id="fin-col-work"
        aria-expanded={open}
        aria-controls="fin-detail-panel"
        onClick={onToggle}
        style={style}
        className={className}
      >
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 whitespace-nowrap text-base font-extrabold text-slate-600">진행건</span>
          <DisclosureChevron open={open} className="ml-auto text-slate-400" />
        </span>
        <span ref={amountRef} className="block w-full min-w-0 max-w-full font-bold tabular-nums text-slate-900" style={amountStyle}>
          {work.items && !work.failed ? `${work.items.length}건` : "—"}
        </span>
        {lines.length > 0 && <FinancePreview rows={lines.map((line): [string] => [line])} />}
      </button>
      {open && detail}
    </div>
  );
}

/** 「진행건」 칸 상세 — 실무/수납과 같은 막대·범례·상태별 목록. 팝업은 칸 오른쪽 끝에 맞춰 띠 밖으로 넘치지 않게. */
export function FinanceWorkDetail({ work }: { work: WorkColumnData }) {
  if (work.failed) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>진행 현황을 불러오지 못했어요.</span>
        <button type="button" onClick={work.onRetry} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-blue-700">다시 시도</button>
      </div>
    );
  }
  if (!work.items) return <SkeletonBars label="불러오는 중…" rows={1} />;
  return <WorkStatusBar items={work.items} onNavigate={work.onNavigate} popoverAlign="end" />;
}
