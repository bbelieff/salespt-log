"use client";
/**
 * 대시보드 맨 위 「첫걸음 N / 7」 카드(2026-11-11 belie 「추천대로 1차」). 일곱 가지 첫 동작 중 다음 할 일에
 * 「해 보기」를 붙인다(안내가 있는 단계는 그 화면에서 스포트라이트가 켜진다). 다 하면 사라지고, 「숨기기」로 접을 수 있다.
 * 끝났는지는 대시보드가 이미 받아 둔 숫자·계약 행으로만 판단한다(새 조회 없음).
 */
import Link from "next/link";
import { useEffect, useMemo } from "react";
import type { DashboardView } from "@/types";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { FIRST_STEPS, firstStepDone, firstStepProgress, type FirstStepCounts } from "@/util/first-steps";
import { useFirstSteps } from "./useFirstSteps";

type Slot = { 수납액?: number } | undefined;
type ContractLike = { 수납1?: Slot; 수납2?: Slot; 수납3?: Slot; 추가진행?: Slot[] };
/** 수납 칸(1~3 + 추가 진행) 중 하나라도 수납액이 있으면 수납한 계약. */
const paid = (r: ContractLike) => [r.수납1, r.수납2, r.수납3, ...(r.추가진행 ?? [])].some((s) => (s?.수납액 ?? 0) > 0);

function countsOf(view: DashboardView, contract?: ContractLike[], reviewSeen = false): FirstStepCounts {
  const sum = (k: "생산" | "유입" | "컨택진행" | "미팅예약" | "미팅완료" | "계약") =>
    view.channelMatrix.reduce((n, c) => n + (c[k] || 0), 0);
  return {
    생산: sum("생산"),
    비용: view.costBreakdown.reduce((n, c) => n + (c.비용 || 0), 0),
    유입: sum("유입"),
    컨택진행: sum("컨택진행"),
    미팅예약: sum("미팅예약"),
    미팅완료: sum("미팅완료"),
    계약: sum("계약"),
    contractRows: contract?.length,
    paidRows: contract?.filter(paid).length,
    reviewSeen,
  };
}

export default function FirstStepsCard({ view }: { view: DashboardView }) {
  const { ready, isTraineeSelf, memory, update } = useFirstSteps();
  const contracts = useContractPayments({ background: true });
  const done = useMemo(
    () => firstStepDone(countsOf(view, contracts.data?.rows, memory.reviewSeen)),
    [view, contracts.data, memory.reviewSeen],
  );
  const progress = firstStepProgress(done);

  // 이미 한 단계의 안내 제안 줄은 다른 화면에서도 다시 띄우지 않는다.
  useEffect(() => {
    if (!isTraineeSelf) return;
    const finished = FIRST_STEPS.filter((s) => s.tour && done[s.key]).map((s) => s.tour!);
    if (finished.some((t) => !memory.finished.includes(t)))
      update((m) => ({ ...m, finished: [...new Set([...m.finished, ...finished])] }));
  }, [done, isTraineeSelf, memory.finished, update]);

  if (!ready || !isTraineeSelf || memory.hidden || !progress.next) return null;

  return (
    <section aria-labelledby="first-steps-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="first-steps-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="first-steps-title" className="text-sm font-bold text-slate-900">
          첫걸음 <span className="num-mono">{progress.done} / {progress.total}</span>
        </h2>
        <span className="text-xs text-slate-500">처음 하는 일을 한 번씩 해 보면 사라져요</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-red" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>
      <ol className="mt-3 grid gap-1 pc:grid-cols-2 pc:gap-x-6">
        {FIRST_STEPS.map((s) => {
          const isDone = done[s.key];
          const isNext = progress.next?.key === s.key;
          return (
            <li key={s.key} className={`flex min-h-11 items-center gap-2 text-sm ${isDone ? "text-slate-500" : isNext ? "font-bold text-slate-900" : "text-slate-700"}`}>
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-xs ${isDone ? "border-emerald-600 bg-emerald-600 text-white" : isNext ? "border-brand-red" : "border-slate-300"}`}
              >
                {isDone ? "✓" : ""}
              </span>
              <span className={isDone ? "line-through" : ""}>{s.label}</span>
              {isDone && <span className="sr-only">(완료)</span>}
              {!isDone &&
                (s.key === "review" ? (
                  <button
                    type="button"
                    onClick={() => {
                      update((m) => ({ ...m, reviewSeen: true }));
                      document.querySelector("[data-testid='dashboard-chart-basis']")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="hit-44 ml-auto text-xs font-bold text-brand-red"
                  >
                    차트 보기 →
                  </button>
                ) : (
                  <Link href={s.href} className="hit-44 ml-auto text-xs font-bold text-brand-red">
                    {s.tour ? "해 보기 →" : "바로 가기 →"}
                  </Link>
                ))}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 text-right">
        <button type="button" onClick={() => update((m) => ({ ...m, hidden: true }))} className="hit-44 text-xs text-slate-500 underline underline-offset-2">
          숨기기
        </button>
      </div>
    </section>
  );
}
