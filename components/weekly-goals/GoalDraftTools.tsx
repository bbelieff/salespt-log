"use client";
import { useState } from "react";
import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalValues } from "@/types/weekly-goals";
import { proposeWeeklyGoals } from "@/util/weekly-goal-proposal";

export default function GoalDraftTools({ previous, dirty, disabled, apply }: {
  previous: { goals: WeeklyGoalValues; task: string } | null;
  dirty: boolean; disabled: boolean;
  apply: (goals: WeeklyGoalValues, task?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<WeeklyGoalValues | null>(null);
  const [error, setError] = useState("");
  const allowOverwrite = () => !dirty || window.confirm("입력 중인 목표·과제를 바꿀까요? 저장 전까지는 반영되지 않아요.");
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!previous || disabled} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40"
        onClick={() => { if (previous && allowOverwrite()) apply({ ...previous.goals }, previous.task); }}>지난주 목표·과제 가져오기</button>
      <button type="button" disabled={disabled} className="min-h-11 rounded-lg border px-3 text-sm"
        onClick={() => { setOpen(true); setPreview(null); setError(""); }}>역산 제안</button>
    </div>
    {open && <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3" aria-label="역산 제안 미리보기">
      <label className="block text-sm">계약 목표
        <input aria-label="제안 계약 목표" type="number" min="0" step="1" inputMode="numeric" value={target}
          onChange={e => { setTarget(e.target.value); setPreview(null); setError(""); }}
          className="ml-2 min-h-11 w-24 rounded-lg border px-2" />
      </label>
      <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => {
        try {
          if (target.trim() === "") throw new Error("계약 목표를 입력해 주세요.");
          setPreview(proposeWeeklyGoals(Number(target))); setError("");
        } catch (e) { setError((e as Error).message); setPreview(null); }
      }}>제안 미리보기</button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {preview && <><dl className="grid grid-cols-5 gap-1 text-center text-xs">{GOAL_KEYS.map(k =>
        <div key={k}><dt>{GOAL_LABELS[k]}</dt><dd className="mt-1 font-bold">{preview[k]}</dd></div>)}</dl>
        <button type="button" disabled={disabled} className="min-h-11 rounded-lg bg-brand-red px-3 text-sm font-bold text-white"
          onClick={() => { if (allowOverwrite()) { apply({ ...preview }); setOpen(false); } }}>초안에 적용</button></>}
      <button type="button" className="ml-2 min-h-11 px-3 text-sm" onClick={() => setOpen(false)}>제안 취소</button>
    </section>}
  </div>;
}
