"use client";

/**
 * FinanceWorkColumn — 대시보드 맨 위 띠의 네 번째 칸 「진행건」(A안, belie 2026-11-13).
 *
 * SSOT: docs/design/components.md §9-2. PC(1024~)에만 보인다(`hidden pc:flex`) — 폰은 지금처럼 세 칸 + 아래 진행건 판.
 * 2026-11-16 belie 「안 눌러도 그냥 나오게」: 요약 두 줄 + 눌러 펼치기를 없애고, 실무/수납과 같은 `WorkStatusBar`
 * (막대·범례·상태별 목록 팝업)를 늘 보여 준다. 그래서 이 칸은 버튼이 아니다. 높이는 막대 + 범례 여섯 개로 정해져 있어
 * 칸 안 스크롤을 두지 않는다 — 스크롤 상자로 감싸면 칸 밖으로 뜨는 상태별 목록 팝업이 잘린다.
 * 자료는 `useDashboardWorkItems`(DashboardWorkStatus) — 아래 진행건 판과 같은 조회라 새 요청이 없다.
 */
import type { CSSProperties, ReactNode, RefObject } from "react";
import SkeletonBars from "@/components/ui/SkeletonBars";
import WorkStatusBar from "@/components/payment/WorkStatusBar";
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

interface ColumnProps {
  work: WorkColumnData;
  style: CSSProperties;
  amountStyle: CSSProperties;
  amountRef: RefObject<HTMLSpanElement | null>;
}

export default function FinanceWorkColumn({ work, style, amountStyle, amountRef }: ColumnProps) {
  return (
    <div data-finance-work-column className="hidden min-w-0 flex-col pc:flex">
      <div id="fin-col-work" style={style} className="flex min-w-0 flex-col gap-1">
        <span className="min-w-0 whitespace-nowrap text-base font-extrabold text-slate-600">진행건</span>
        <span ref={amountRef} className="block w-full min-w-0 max-w-full font-bold tabular-nums text-slate-900" style={amountStyle}>
          {work.items && !work.failed ? `${work.items.length}건` : "—"}
        </span>
      </div>
      <div role="group" aria-labelledby="fin-col-work" data-finance-work-detail className="pr-2">
        <FinanceWorkDetail work={work} />
      </div>
    </div>
  );
}

/** 「진행건」 칸 본문 — 실무/수납과 같은 막대·범례·상태별 목록. 팝업은 칸 오른쪽 끝에 맞춰 띠 밖으로 넘치지 않게. */
function FinanceWorkDetail({ work }: { work: WorkColumnData }) {
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
