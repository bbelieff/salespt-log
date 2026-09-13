"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GOAL_KEYS, GOAL_LABELS, WeeklyGoalInput, type WeeklyGoalPrivateRecord, type WeeklyGoalRecord, type WeeklyGoalView } from "@/types/weekly-goals";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import GoalRings from "./GoalRings";
import GoalCopyPanel from "./GoalCopyPanel";
import GoalInternalEditor from "./GoalInternalEditor";
import GoalTaskRows from "./GoalTaskRows";
import { goalAccessDenied, goalJSON, goalParams } from "./client";
import { useGoalHistoryGuard } from "./useGoalHistoryGuard";
import GoalDraftTools from "./GoalDraftTools";
import { editableTaskRows, joinTaskRows, splitTaskRows } from "@/util/weekly-goal-tasks";

export default function WeeklyGoalEditor({ view, changeWeek, reload, readFailed = false }: {
  view: WeeklyGoalView; changeWeek: (week: number) => void; reload: () => void; readFailed?: boolean;
}) {
  const [saved, setSaved] = useState(view.current.record);
  const [draft, setDraft] = useState<WeeklyGoalRecord>(view.current.record);
  const [taskRows, setTaskRows] = useState(() => editableTaskRows(view.current.record.task));
  const [internalDirty, setInternalDirty] = useState(false);
  const [internalRecord, setInternalRecord] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [saving, setSaving] = useState(false);
  // 저장 피드백은 버튼 라벨로. `message` 는 실패·안내만 담는다.
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [copyToken, setCopyToken] = useState(0);
  const lock = useRef(false);
  const internalSave = useRef<(() => Promise<void>) | null>(null);
  const guarded = useGuardedNav();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const anyDirty = dirty || internalDirty;
  useGoalHistoryGuard(anyDirty);
  const shown = { ...view, current: { ...view.current, record: saved } };
  useEffect(() => {
    if (!dirty) {
      setSaved(view.current.record); setDraft(view.current.record);
      setTaskRows(editableTaskRows(view.current.record.task));
    }
    // Refreshes may update actuals, but must never overwrite an unsaved draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.current.record]);
  // The rows are the source of truth for `task`; keep the saved-comparison draft in step.
  useEffect(() => { setDraft(current => ({ ...current, task: joinTaskRows(taskRows) })); }, [taskRows]);

  const bindInternalSave = useCallback((fn: (() => Promise<void>) | null) => { internalSave.current = fn; }, []);

  async function save() {
    if (lock.current) throw new Error("저장 중이에요.");
    const task = joinTaskRows(taskRows);
    if (task.length > 10000) { setMessage("PT과제가 너무 길어요. 10,000자 아래로 줄여 주세요."); throw new Error("invalid"); }
    const parsed = WeeklyGoalInput.safeParse({ goals: draft.goals, task, revision: saved.revision });
    if (!parsed.success) { setMessage("목표는 0 이상의 정수 또는 빈칸으로 입력해 주세요."); throw new Error("invalid"); }
    lock.current = true; setSaving(true); setMessage(""); setDone(false);
    try {
      if (dirty) {
        const result = await goalJSON<{ revision: number }>("/api/weekly-goals?" + goalParams(view), parsed.data);
        const next = { ...draft, ...parsed.data, revision: result.revision };
        setSaved(next); setDraft(next);
        window.dispatchEvent(new Event("weekly-goals-saved"));
      }
      // 트레이닝 후 특이사항까지 한 번에. Internal failure must still surface as a failed save.
      if (internalSave.current) await internalSave.current();
      setDone(true);
      setCopyToken(token => token + 1);
    } catch (e) {
      setMessage((e as Error).message);
      if (goalAccessDenied(e)) reload();
      throw e;
    }
    finally { lock.current = false; setSaving(false); }
  }
  useDirtyEntry("weekly-goal-public", dirty, save, () => {
    setDraft(saved); setTaskRows(editableTaskRows(saved.task));
  }, "주간 목표·PT과제");

  const previousTasks = splitTaskRows(view.previous?.record.task ?? "");
  return <form onSubmit={e => { e.preventDefault(); void save().catch(() => {}); }} className="space-y-5 ph-no-capture">
    {/* 주차 내비게이터 1행 — 페이지 배너 바로 아래에 고정. */}
    <header className="sticky top-36 z-30 -mx-1 flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 2xl:top-[6.5rem]">
      <button type="button" disabled={view.current.week <= 1 || saving} onClick={() => guarded(() => changeWeek(view.current.week - 1))}
        className="min-h-11 shrink-0 rounded-lg border px-3 text-sm disabled:opacity-40">이전 주</button>
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-bold">{view.student.name} · {view.student.cohort} · {view.current.week}주차</p>
        <p className="truncate text-xs text-gray-500">{view.current.start} ~ {view.current.end}</p>
      </div>
      <button type="button" disabled={saving} onClick={() => guarded(() => changeWeek(view.current.week + 1))}
        className="min-h-11 shrink-0 rounded-lg border px-3 text-sm">다음 주</button>
    </header>

    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <GoalRings goals={saved.goals} actuals={view.current.actuals} />
    </section>

    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="font-bold">목표달성 및 수립</h2>
      {view.previous && <p className="text-xs text-gray-500">지난주 {view.previous.start} ~ {view.previous.end}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead><tr className="text-xs text-gray-500">
            <th className="py-2 pr-2 font-semibold">항목</th>
            <th className="px-2 py-2 text-right font-semibold">지난 목표</th>
            <th className="px-2 py-2 text-right font-semibold">지난 성과</th>
            <th className="px-2 py-2 text-right font-semibold">이번 목표</th>
          </tr></thead>
          <tbody>{GOAL_KEYS.map(k => <tr key={k} className="border-t border-gray-100">
            <th className="py-2 pr-2 text-left font-medium">{GOAL_LABELS[k]}</th>
            <td className="px-2 py-2 text-right tabular-nums text-gray-500">{view.previous?.record.goals[k] ?? "—"}</td>
            <td className="px-2 py-2 text-right tabular-nums">{view.previous?.actuals[k] ?? "—"}</td>
            <td className="px-2 py-2 text-right">
              <input aria-label={`이번 목표 ${GOAL_LABELS[k]}`} type="number" inputMode="numeric" min="0" max="2147483647" step="1" placeholder="—"
                disabled={saving} value={draft.goals[k] ?? ""}
                onChange={e => setDraft({ ...draft, goals: { ...draft.goals, [k]: e.target.value === "" ? null : Number(e.target.value) } })}
                className="min-h-11 w-24 rounded-xl border border-gray-300 px-2 text-right text-sm" />
            </td>
          </tr>)}</tbody>
        </table>
      </div>

      <GoalDraftTools cumulative={view.cumulative} weeksCounted={Math.max(0, view.current.week - 1)}
        dirty={dirty} disabled={saving} apply={goals => {
          setDraft(current => ({ ...current, goals }));
          setMessage("초안에 적용했어요. 확인 후 저장해 주세요.");
        }} />

      {view.previous && previousTasks.length > 0 && <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-semibold">지난 PT과제</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">{previousTasks.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ol>
      </div>}

      <GoalTaskRows label="이번 주 PT과제" rows={taskRows} onChange={setTaskRows} disabled={saving}
        placeholder="과제 하나를 한 줄로 적어 주세요." />
    </section>

    {view.canReadInternal && <GoalInternalEditor view={shown} onDirty={setInternalDirty}
      onRecord={setInternalRecord} bindSave={bindInternalSave} />}

    <GoalCopyPanel view={shown} internal={internalRecord ?? undefined}
      dirty={anyDirty || readFailed} autoCopyToken={copyToken} />

    <div className="sticky bottom-0 z-20 -mx-1 space-y-2 border-t border-gray-200 bg-white/95 px-1 py-3 backdrop-blur">
      <button type="submit" disabled={!anyDirty || saving}
        className="min-h-12 w-full rounded-xl bg-brand-red px-4 font-bold text-white disabled:opacity-50">
        {saving ? "저장 중…" : anyDirty ? "목표·PT과제·기록 저장" : done ? "저장 완료" : "저장됨"}
      </button>
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-sm">{message}</p>
        <button type="button" disabled={saving} className="min-h-11 shrink-0 text-sm underline"
          onClick={() => guarded(reload)}>최신 내용 불러오기</button>
      </div>
    </div>
  </form>;
}
