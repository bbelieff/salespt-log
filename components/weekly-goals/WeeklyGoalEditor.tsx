"use client";
import { useEffect, useRef, useState } from "react";
import { GOAL_KEYS, GOAL_LABELS, WeeklyGoalInput, type WeeklyGoalRecord, type WeeklyGoalView } from "@/types/weekly-goals";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import GoalRings from "./GoalRings";
import GoalCopyPanel from "./GoalCopyPanel";
import GoalInternalEditor from "./GoalInternalEditor";
import { goalAccessDenied, goalJSON, goalParams } from "./client";
import { useGoalHistoryGuard } from "./useGoalHistoryGuard";
import GoalDraftTools from "./GoalDraftTools";

export default function WeeklyGoalEditor({ view, changeWeek, reload, readFailed = false }: {
  view: WeeklyGoalView; changeWeek: (week: number) => void; reload: () => void; readFailed?: boolean;
}) {
  const [saved, setSaved] = useState(view.current.record);
  const [draft, setDraft] = useState<WeeklyGoalRecord>(view.current.record);
  const [together, setTogether] = useState(true);
  const [internalDirty, setInternalDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const guarded = useGuardedNav();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useGoalHistoryGuard(dirty || internalDirty);
  const shown = { ...view, current: { ...view.current, record: saved } };
  useEffect(() => {
    if (!dirty) { setSaved(view.current.record); setDraft(view.current.record); }
    // Refreshes may update actuals, but must never overwrite an unsaved draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.current.record]);
  async function save() {
    if (lock.current) throw new Error("저장 중이에요.");
    const parsed = WeeklyGoalInput.safeParse({ goals: draft.goals, task: draft.task, revision: saved.revision });
    if (!parsed.success) { setMessage("목표는 0 이상의 정수 또는 빈칸으로 입력해 주세요."); throw new Error("invalid"); }
    lock.current = true; setSaving(true); setMessage("");
    try {
      const result = await goalJSON<{ revision: number }>("/api/weekly-goals?" + goalParams(view), parsed.data);
      const next = { ...draft, revision: result.revision };
      setSaved(next); setDraft(next); setMessage("저장됐어요.");
      window.dispatchEvent(new Event("weekly-goals-saved"));
    } catch (e) {
      setMessage((e as Error).message);
      if (goalAccessDenied(e)) reload();
      throw e;
    }
    finally { lock.current = false; setSaving(false); }
  }
  useDirtyEntry("weekly-goal-public", dirty, save, () => setDraft(saved), "주간 목표·PT과제");
  return <div className="space-y-5 ph-no-capture">
    <header className="sticky top-0 z-10 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{view.student.name} · {view.student.cohort} · 주간 목표</h1>
        {view.canReadInternal && <button type="button" className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          onClick={() => guarded(() => setTogether(!together))}>{together ? "트레이너 기록 열기" : "함께 보기"}</button>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" disabled={view.current.week <= 1 || saving} onClick={() => guarded(() => changeWeek(view.current.week - 1))}
          className="min-h-11 rounded-lg border px-3 disabled:opacity-40">이전 주</button>
        <div className="text-center"><p className="font-bold">{view.current.week}주차</p>
          <p className="text-xs text-gray-500">{view.current.start} ~ {view.current.end}</p></div>
        <button type="button" disabled={saving} onClick={() => guarded(() => changeWeek(view.current.week + 1))}
          className="min-h-11 rounded-lg border px-3">다음 주</button>
      </div>
    </header>
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <GoalRings goals={saved.goals} actuals={view.current.actuals} />
    </section>
    <div className="grid gap-5 pc:grid-cols-2 pc:items-start">
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-bold">지난주와 비교</h2>
        {view.previous ? <><p className="text-xs text-gray-500">{view.previous.start} ~ {view.previous.end}</p>
          <table className="w-full text-left text-sm"><thead><tr><th className="py-2">항목</th><th>지난 목표</th><th>지난 실적</th><th>이번 목표</th></tr></thead>
            <tbody>{GOAL_KEYS.map(k => <tr key={k} className="border-t border-gray-100">
              <th className="py-3 font-medium">{GOAL_LABELS[k]}</th><td>{view.previous!.record.goals[k] ?? "—"}</td>
              <td>{view.previous!.actuals[k]}</td><td>{saved.goals[k] ?? "—"}</td></tr>)}</tbody></table>
          <p className="whitespace-pre-wrap break-words text-sm">지난 PT과제: {view.previous.record.task || "미기재"}</p>
        </> : <p className="text-sm text-gray-500">첫 주예요. 이번 주 PT과제부터 정해 보세요.</p>}
      </section>
      <form onSubmit={e => { e.preventDefault(); void save().catch(() => {}); }} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-bold">이번 주 목표·PT과제</h2>
        <GoalDraftTools previous={view.previous?.record ?? null} dirty={dirty} disabled={saving}
          apply={(goals, task) => { setDraft(current => ({ ...current, goals, ...(task === undefined ? {} : { task }) })); setMessage("초안에 적용했어요. 확인 후 저장해 주세요."); }} />
        <fieldset disabled={saving} className="space-y-4">
          <div className="grid grid-cols-5 gap-1 pc:gap-3">{GOAL_KEYS.map(k => <label key={k} className="min-w-0 text-center text-xs font-semibold pc:text-sm">{GOAL_LABELS[k]}
            <input aria-label={GOAL_LABELS[k]} type="number" inputMode="numeric" min="0" max="2147483647" step="1" placeholder="—" value={draft.goals[k] ?? ""}
              onChange={e => setDraft({ ...draft, goals: { ...draft.goals, [k]: e.target.value === "" ? null : Number(e.target.value) } })}
              className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-gray-300 px-1 text-center text-sm" /></label>)}</div>
          <label className="block text-sm font-semibold">이번 주 PT과제
            <textarea aria-label="이번 주 PT과제" rows={5} maxLength={10000} value={draft.task} onChange={e => setDraft({ ...draft, task: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-300 p-3" placeholder="정량 목표 없이 과제만 적어도 괜찮아요." /></label>
          <button type="submit" disabled={!dirty || saving} className="min-h-11 w-full rounded-xl bg-brand-red px-4 font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "목표·PT과제 저장"}</button>
        </fieldset>
        <p role="status" className="text-sm">{message}</p>
        <button type="button" disabled={saving} className="min-h-11 text-sm underline" onClick={() => guarded(reload)}>최신 내용 불러오기</button>
        <GoalCopyPanel key={saved.revision} view={shown} dirty={dirty || internalDirty || readFailed} />
      </form>
    </div>
    {view.canReadInternal && !together && <GoalInternalEditor view={shown} onDirty={setInternalDirty} publicDirty={dirty || readFailed} />}
  </div>;
}
