/**
 * 주간목표 한 줄 문장 승인표 — 목업 주소 /headlines. 영업이익 문장은 2026-10-13 사용자 요청으로 보류.
 * 실제 CardHeadline·GoalRings 에 합성 숫자를 직접 넣어 주간목표 문구 상태를 세로로 늘어놓는다.
 * 문구는 실제 순수 함수(goalHeadline)가 만든다. 위 버튼으로 320·390 화면 폭과 넓은 폭을 바꿔
 * 줄바꿈(어절 단위, 말줄임 없음)을 본다. 실제 대시보드 연결은 /dashboard?finance=…&goals=… 로 본다.
 * 이 파일은 대시보드 진입 때 B 시나리오 쿠키(headline_finance·headline_goals)도 적는다(dashboard-followups-server.mjs).
 * 날짜는 전부 오늘(KST) 기준 계산 — 날짜 리터럴 없음. 이름·금액은 합성값.
 */
import React from "react";
import CardHeadline from "../../components/ui/CardHeadline";
import GoalRings from "../../components/weekly-goals/GoalRings";
import { goalHeadline } from "../../components/weekly-goals/goal-headline";
import { todayKst } from "../../lib/util/finance-period";
import type { GoalActuals, WeeklyGoalValues } from "../../lib/types/weekly-goals";

// ── 시나리오 쿠키(대시보드 진입 때만 갱신, 다른 화면 직접 진입은 유지) ─────────────────
const FINANCE = ["profit", "loss", "cost-only", "none", "refund", "ledger-fail", "big"] as const;
const GOALS = ["remaining", "done", "unset", "zero"] as const;
function syncHeadlineCookies() {
  const params = new URLSearchParams(location.search);
  const onDashboard = location.pathname === "/" || location.pathname === "/dashboard";
  const finance = FINANCE.find((s) => s === params.get("finance")) ?? (params.get("loss") === "1" ? "loss" : params.get("big") === "1" ? "big" : undefined);
  const goals = GOALS.find((s) => s === params.get("goals")) ?? (params.get("goalDone") === "1" ? "done" : undefined);
  if (finance || onDashboard) document.cookie = `headline_finance=${finance ?? ""}; path=/`;
  if (goals || onDashboard) document.cookie = `headline_goals=${goals ?? ""}; path=/`;
}
syncHeadlineCookies();

// ── 날짜(오늘 KST) ───────────────────────────────────────────────
const today = todayKst();
const shift = (iso: string, days: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
// ── 주간 목표 문장 ───────────────────────────────────────────────
const g = (o: Partial<WeeklyGoalValues>): WeeklyGoalValues => ({ production: null, inflow: null, contacts: null, meetings: null, contracts: null, ...o });
const a = (o: Partial<GoalActuals>): GoalActuals => ({ production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0, ...o });
const REMAIN = { goals: g({ production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 2 }), actuals: a({ production: 12, inflow: 4, contacts: 3, meetings: 2, contracts: 1 }) };
interface GoalCase { title: string; goals: WeeklyGoalValues; actuals: GoalActuals; ended: boolean }
const GOAL_CASES: GoalCase[] = [
  { title: "남은 목표 · 이번 주 (계약 → 미팅완료 → 컨택완료 → 유입 → 생산 순서의 첫 미달)", ...REMAIN, ended: false },
  { title: "남은 목표 · 지난 주로 넘김 (과거형)", ...REMAIN, ended: true },
  { title: "세운 목표 모두 달성 (초과 포함)", goals: g({ production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 1 }), actuals: a({ production: 24, inflow: 10, contacts: 6, meetings: 3, contracts: 1 }), ended: false },
  { title: "목표 미기재 · 이번 주", goals: g({}), actuals: a({ production: 6, inflow: 2 }), ended: false },
  { title: "목표 미기재 · 지난 주", goals: g({}), actuals: a({ production: 6, inflow: 2 }), ended: true },
  { title: "목표 0 과 미기재만 → 문장 없음", goals: g({ production: 0 }), actuals: a({ production: 3 }), ended: false },
  { title: "가장 긴 문구 (320 화면 한 줄 확인)", goals: g({ contacts: 1500 }), actuals: a({ contacts: 266 }), ended: false },
];

function GoalSample({ c }: { c: GoalCase }) {
  const h = goalHeadline({ goals: c.goals, actuals: c.actuals, ended: c.ended });
  const start = shift(today, c.ended ? -10 : -3);
  return (
    <Sample title={c.title}>
      <section aria-label="주간 목표" className="relative isolate flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-gray-900"><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-teal-400" /><span>주간 목표 <span className="text-sm text-gray-500">· {c.ended ? 6 : 7}주차</span></span></h2>
        <p className="mb-2 pl-3 text-xs text-gray-500">{start} ~ {shift(start, 6)}</p>
        {h && <CardHeadline headline={h} className="mb-2" />}
        <GoalRings goals={c.goals} actuals={c.actuals} showStatus={false} />
      </section>
    </Sample>
  );
}

// ── 화면 ────────────────────────────────────────────────────────
function Sample({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-semibold text-slate-500">{title}</p>
      {children}
    </div>
  );
}

const WIDTHS = [{ label: "320 화면", px: 296 }, { label: "390 화면", px: 366 }, { label: "넓게", px: 0 }] as const;
const LIVE = ["profit", "loss", "refund", "ledger-fail", "big", "none"] as const;

export default function HeadlineMatrix() {
  const [width, setWidth] = React.useState<number>(296);
  return (
    <main className="min-h-screen bg-slate-50 p-3 pb-24">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <strong className="mr-1 text-sm text-slate-700">주간목표 문장 확인</strong>
        {WIDTHS.map((w) => (
          <button key={w.label} type="button" aria-pressed={width === w.px} onClick={() => setWidth(w.px)}
            className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold ${width === w.px ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}>{w.label}</button>
        ))}
      </div>
      <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>실제 대시보드에서 보기:</span>
        {[...LIVE.map((k) => `finance=${k}`), "goalDone=1", "goals=unset", "goals=zero"].map((q) => (
          <a key={q} className="font-semibold text-blue-700 underline" href={`/dashboard?${q}`}>{q}</a>
        ))}
      </p>
      <div className="space-y-4" style={width ? { width, maxWidth: "100%" } : undefined}>
        <h2 className="text-base font-extrabold text-gray-900">주간 목표 카드</h2>
        {GOAL_CASES.map((c) => <GoalSample key={c.title} c={c} />)}
      </div>
    </main>
  );
}
