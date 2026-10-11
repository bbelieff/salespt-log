/**
 * 대시보드 한 줄 문장(B #8) 승인표 — 목업 주소 /headlines.
 * 실제 CardHeadline·FinanceSummaryBoxes·GoalRings 에 합성 숫자를 직접 넣어 모든 문구 상태를 세로로 늘어놓는다.
 * 문구는 실제 순수 함수(financeHeadline·goalHeadline)가 만든다. 위 버튼으로 320·390 화면 폭과 넓은 폭을 바꿔
 * 줄바꿈(어절 단위, 말줄임 없음)을 본다. 실제 대시보드 연결은 /dashboard?finance=…&goals=… 로 본다.
 * 이 파일은 대시보드 진입 때 B 시나리오 쿠키(headline_finance·headline_goals)도 적는다(dashboard-followups-server.mjs).
 * 날짜는 전부 오늘(KST) 기준 계산 — 날짜 리터럴 없음. 이름·금액은 합성값.
 */
import React from "react";
import CardHeadline, { type Headline } from "../../components/ui/CardHeadline";
import FinanceSummaryBoxes from "../../components/dashboard/FinanceSummaryBoxes";
import GoalRings from "../../components/weekly-goals/GoalRings";
import { ALL_PERIOD_PREFIX, financeHeadline } from "../../components/dashboard/finance-headline";
import { goalHeadline } from "../../components/weekly-goals/goal-headline";
import { PERIOD_LABEL, periodBounds, todayKst, type DateRange, type FinancePeriod } from "../../lib/util/finance-period";
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
const rangeOf = (period: FinancePeriod, partial = false): DateRange =>
  periodBounds(period, partial ? "" : shift(today, -6), partial ? "" : today, today);
const md = (iso: string) => iso.slice(5).replace("-", "/");

// ── 재무 문장 ────────────────────────────────────────────────────
interface FinanceCase { title: string; period: FinancePeriod; partial?: boolean; fee: number; received?: number; refunded?: number; db: number; extra: number | null }
const FINANCE_CASES: FinanceCase[] = [
  { title: "영업이익 > 0 · 전체", period: "all", fee: 2_500_000, received: 800_000, db: 1_505_480, extra: 200_000 },
  { title: "영업이익 > 0 · 이번 달 (스펙 예시)", period: "month", fee: 1_500_000, db: 905_480, extra: 0 },
  { title: "영업이익 > 0 · 이번 주", period: "week", fee: 1_500_000, db: 905_480, extra: 0 },
  { title: "영업이익 > 0 · 직접 설정(두 날짜 고름)", period: "custom", fee: 1_500_000, db: 905_480, extra: 0 },
  { title: "직접 설정 · 날짜 덜 고름 → 숫자도 전체 기간", period: "custom", partial: true, fee: 2_500_000, received: 800_000, db: 1_505_480, extra: 200_000 },
  { title: "기록 없음", period: "all", fee: 0, db: 0, extra: 0 },
  { title: "매출 0 · 비용만", period: "all", fee: 0, db: 300_000, extra: 0 },
  { title: "비용이 매출보다 많음", period: "all", fee: 500_000, db: 620_000, extra: 0 },
  { title: "매출 = 비용", period: "all", fee: 700_000, db: 500_000, extra: 200_000 },
  { title: "그 달 계약해지 반환 > 매출", period: "month", fee: 500_000, refunded: 2_000_000, db: 0, extra: 0 },
  { title: "경비장부 못 읽음 · 매출 > 0 (영업이익은 말하지 않음)", period: "all", fee: 1_200_000, db: 300_000, extra: null },
  { title: "경비장부 못 읽음 · 매출 0 → 문장 없음(자리만 유지)", period: "all", fee: 0, db: 300_000, extra: null },
  { title: "8자리 금액 (320 화면 두 줄 허용)", period: "all", fee: 15_000_000, db: 2_654_322, extra: 0 },
];

function FinanceSample({ c }: { c: FinanceCase }) {
  const range = rangeOf(c.period, c.partial);
  const revenue = c.fee + (c.received ?? 0) - (c.refunded ?? 0);
  const cost = c.db + (c.extra ?? 0);
  const h = financeHeadline({ period: c.period, range, revenue, cost, additionalKnown: c.extra !== null });
  const label = range ? `${PERIOD_LABEL[c.period]} ${md(range[0])}~${md(range[1])}` : PERIOD_LABEL.all;
  return (
    <Sample title={c.title}>
      <section aria-label="매출·비용·영업이익" className="rounded-2xl border border-slate-200 bg-slate-100 p-2">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          <strong className="mr-1 whitespace-nowrap text-sm text-slate-700">매출·비용·영업이익</strong>
          <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-blue-500 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700">{PERIOD_LABEL[c.period]}</span>
          {c.partial && <span className="whitespace-nowrap text-xs text-amber-700">시작일과 종료일을 고르면 그 기간만 계산해요</span>}
        </div>
        <CardHeadline headline={h} className="mb-2 min-h-5 px-1" />
        <FinanceSummaryBoxes revenue={revenue} cost={cost} feeIncome={c.fee} commissionIncome={c.received ?? 0} refunded={c.refunded ?? 0}
          dbCostTotal={c.db} additionalCost={c.extra} onOpenExpenseLedger={() => {}} periodLabel={label} contractCount={c.fee > 0 ? 1 : 0} />
      </section>
    </Sample>
  );
}

/** 「전체」 접두어 비교 — 미래 날짜로 미리 적은 수납·계약이 있으면 「지금까지」가 조금 앞서 말할 수 있다. 계산은 같다. */
function PrefixChoice() {
  const h = financeHeadline({ period: "all", range: null, revenue: 3_300_000, cost: 1_705_480, additionalKnown: true });
  if (!h) return null;
  const alt: Headline = { ...h, text: h.text.replace(ALL_PERIOD_PREFIX, "전체 기간에") };
  return (
    <Sample title="결정 필요 · 「전체」 칩 접두어 — 위(현재) / 아래(대안). 미래 날짜로 미리 적은 수납·계약이 있으면 「지금까지」가 조금 앞서 말할 수 있어요">
      <div className="space-y-2">
        <div className="rounded-xl bg-white p-3"><CardHeadline headline={h} /></div>
        <div className="rounded-xl bg-white p-3"><CardHeadline headline={alt} /></div>
      </div>
    </Sample>
  );
}

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
        {h && <CardHeadline headline={h} className="mb-1" />}
        <p className="mb-2 text-xs text-gray-500">{start} ~ {shift(start, 6)}</p>
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
        <strong className="mr-1 text-sm text-slate-700">한 줄 문장 승인표</strong>
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
        <h2 className="text-base font-extrabold text-gray-900">① 매출·비용·영업이익 묶음</h2>
        <PrefixChoice />
        {FINANCE_CASES.map((c) => <FinanceSample key={c.title} c={c} />)}
        <h2 className="pt-2 text-base font-extrabold text-gray-900">② 주간 목표 카드</h2>
        {GOAL_CASES.map((c) => <GoalSample key={c.title} c={c} />)}
      </div>
    </main>
  );
}
