/**
 * CollapsibleGoalCard — 수료생 대시보드의 주간 목표 카드(belie 2026-11-05 「졸업한 사람들은 PT과제가
 * 없어지니 주간목표를 접어 놓을 수 있게 · 모바일은 맨 아래·기본 접힘 · 한 번 열거나 접으면 기억」).
 *
 * 펼침 여부는 이 기기 브라우저(localStorage)에 화면 크기별로 따로 기억한다.
 * 기억이 없으면 모바일은 접힘, PC 는 펼침으로 시작한다.
 */
"use client";

import { useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

export type GoalCardLayout = "mobile" | "pc";

export const goalCardStorageKey = (layout: GoalCardLayout) => `salespt:dashboard:goals-open:${layout}`;

function readOpen(layout: GoalCardLayout): boolean {
  const fallback = layout === "pc";
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(goalCardStorageKey(layout));
    return saved === null ? fallback : saved === "1";
  } catch {
    return fallback;
  }
}

export default function CollapsibleGoalCard({ layout, className = "" }: { layout: GoalCardLayout; className?: string }) {
  const [open, setOpen] = useState(() => readOpen(layout));
  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(goalCardStorageKey(layout), next ? "1" : "0");
    } catch {
      // 저장이 막힌 브라우저 — 이번 화면에서만 유지.
    }
  };

  if (open) return <WeeklyGoalSummary className={className} onCollapse={() => toggle(false)} />;
  return <section aria-label="주간 목표" className={className}>
    <button type="button" aria-expanded="false" onClick={() => toggle(true)}
      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
      <Target className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <span className="min-w-0 flex-1 text-sm font-extrabold text-slate-700">주간 목표 · PT과제</span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-slate-600">펼치기<ChevronDown className="h-4 w-4" aria-hidden /></span>
    </button>
  </section>;
}
