"use client";
import { useState } from "react";
import { GOAL_LABELS, type GoalActuals, type WeeklyGoalValues } from "@/types/weekly-goals";
import { proposeFromCumulative, type GoalProposal } from "@/util/weekly-goal-proposal";

export default function GoalDraftTools({ cumulative, weeksCounted, dirty, disabled, apply }: {
  cumulative: GoalActuals;
  /** Completed weeks behind the cumulative figures — shown so the basis is auditable. */
  weeksCounted: number;
  dirty: boolean; disabled: boolean;
  apply: (goals: Partial<WeeklyGoalValues>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [proposal, setProposal] = useState<GoalProposal | null>(null);
  const [error, setError] = useState("");
  const allowOverwrite = () => !dirty || window.confirm("입력 중인 목표를 바꿀까요? 저장 전까지는 반영되지 않아요.");
  return <div className="space-y-3">
    <button type="button" disabled={disabled} className="min-h-11 rounded-lg border px-3 text-sm"
      onClick={() => { setOpen(true); setProposal(null); setError(""); }}>역산 제안</button>
    {open && <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3" aria-label="역산 제안 미리보기">
      <p className="text-xs text-gray-600">{weeksCounted > 0 ? `본인의 1주차부터 ${weeksCounted}주차까지 누적 실적 비율로 역산해요.` : "첫 주차라 이전 누적 실적이 없어요. 목표를 직접 입력해 주세요."}</p>
      <label className="block text-sm">계약 목표
        <input aria-label="제안 계약 목표" type="number" min="0" step="1" inputMode="numeric" value={target}
          onChange={e => { setTarget(e.target.value); setProposal(null); setError(""); }}
          className="ml-2 min-h-11 w-24 rounded-lg border px-2" />
      </label>
      <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => {
        try {
          if (target.trim() === "") throw new Error("계약 목표를 입력해 주세요.");
          setProposal(proposeFromCumulative(cumulative, Number(target))); setError("");
        } catch (e) { setError((e as Error).message); setProposal(null); }
      }}>제안 미리보기</button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {proposal && <>
        <table className="w-full text-left text-xs" aria-label="역산 근거">
          <thead><tr className="text-gray-500"><th className="py-1">항목</th><th>누적 실적</th><th>계약 1건당</th><th>제안</th></tr></thead>
          <tbody>{proposal.basis.map(b => <tr key={b.key} className="border-t border-gray-200">
            <th className="py-1.5 font-medium">{GOAL_LABELS[b.key]}</th>
            <td className="tabular-nums">{b.cumulative}</td>
            <td className="tabular-nums">{b.perContract === null ? "기록 없음" : b.perContract.toFixed(1)}</td>
            <td className="font-bold tabular-nums">{b.value === null ? "계산 불가" : b.value}</td>
          </tr>)}</tbody>
        </table>
        {proposal.basis.some(b => b.reason !== null) && <p className="text-xs text-gray-500">
          본인의 누적 계약 또는 해당 항목 실적이 없어 계산할 수 없는 목표는 기존 입력을 유지해요. 고정 전환율은 사용하지 않아요.</p>}
        <button type="button" disabled={disabled} className="min-h-11 rounded-lg bg-brand-red px-3 text-sm font-bold text-white"
          onClick={() => { if (allowOverwrite()) { apply(Object.fromEntries(Object.entries(proposal.goals).filter(([, value]) => value !== null))); setOpen(false); } }}>초안에 적용</button>
      </>}
      <button type="button" className="ml-2 min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>제안 취소</button>
    </section>}
  </div>;
}
