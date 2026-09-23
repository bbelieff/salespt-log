"use client";
import { useEffect, useRef, useState } from "react";
import { GOAL_KEYS, GOAL_LABELS, type WeeklyGoalRecord, type WeeklyGoalView } from "@/types/weekly-goals";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import GoalRings from "./GoalRings";
import GoalCopyPanel from "./GoalCopyPanel";
import GoalInternalEditor from "./GoalInternalEditor";
import GoalTaskRows from "./GoalTaskRows";
import { goalAccessDenied, goalJSON } from "./client";
import { useGoalHistoryGuard } from "./useGoalHistoryGuard";
import GoalDraftTools from "./GoalDraftTools";
import { buildPublicPayload, discardUnsaved, goalParamsFromTarget, goalTargetOf } from "@/components/weekly-goals/weeklyGoalAutosave";
import { editableTaskRows, joinTaskRows, splitTaskRows } from "@/util/weekly-goal-tasks";

interface PublicDraft {
  goals: WeeklyGoalRecord["goals"];
  task: string;
}

const toDraft = (record: Pick<WeeklyGoalRecord, "goals" | "task">): PublicDraft => ({
  goals: record.goals,
  task: record.task,
});

export default function WeeklyGoalEditor({ view, changeWeek, reload, readFailed = false }: {
  view: WeeklyGoalView; changeWeek: (week: number) => void; reload: () => void; readFailed?: boolean;
}) {
  // CAS revision lives outside the draft — PUTs always carry the last SAVED
  // revision, never a draft guess (separate from the internal record, #1010).
  const revisionRef = useRef(view.current.record.revision);
  const [conflict, setConflict] = useState(false);
  const [overwriting, setOverwriting] = useState(false);
  const [internalDirty, setInternalDirty] = useState(false);
  const [internalRecord, setInternalRecord] = useState<import("@/types/weekly-goals").WeeklyGoalPrivateRecord | null>(null);
  const [taskRows, setTaskRows] = useState(() => editableTaskRows(view.current.record.task));
  const guarded = useGuardedNav();

  const publicAuto = useAutosave<PublicDraft>({
    target: goalTargetOf(view, "public"),
    initial: toDraft(view.current.record),
    delayMs: 800,
    // Bound to the CAPTURED queue target — never the live view, so a
    // debounced save scheduled on week N still PUTs week N after a switch.
    save: async ({ target, payload }) => {
      const built = buildPublicPayload(payload.goals, payload.task, revisionRef.current);
      if (!built.ok) throw new Error(built.error);
      try {
        const result = await goalJSON<{ revision: number }>(
          "/api/weekly-goals?" + goalParamsFromTarget(target),
          built.payload,
        );
        revisionRef.current = result.revision;
        window.dispatchEvent(new Event("weekly-goals-saved"));
      } catch (e) {
        if (e instanceof Error && (e as { status?: number }).status === 409) {
          setConflict(true);
          throw new Error("다른 곳에서 먼저 저장됐어요. 입력은 그대로 두었어요.");
        }
        if (goalAccessDenied(e)) reload();
        throw e;
      }
    },
  });

  // Latest draft mirror for async closures: overwrite's catch must retain
  // the CURRENT text typed while waiting, never the click-time closure.
  const draftRef = useRef(publicAuto.draft);
  draftRef.current = publicAuto.draft;

  // While a conflict/overwrite is open, routine input stays editable but
  // only stages (no schedule, no automatic 409 retry); a newer draft
  // commits serialized after the overwrite ACK. No loss either way.
  const deferPublic = (next: PublicDraft) => {
    if (conflict || overwriting) publicAuto.stage(next);
    else publicAuto.update(next);
  };

  const dirty = publicAuto.dirty;
  const anyDirty = dirty || internalDirty;
  useGoalHistoryGuard(anyDirty);

  // Refetch merge (#1011): server-current actuals flow through `view`; an
  // unsent draft is never overwritten — only the clean baseline moves.
  const recordKey = JSON.stringify(view.current.record);
  const firstRecord = useRef(recordKey);
  useEffect(() => {
    if (recordKey === firstRecord.current) return;
    firstRecord.current = recordKey;
    const next = view.current.record;
    const clean = JSON.stringify(publicAuto.draft) === JSON.stringify(toDraft(publicAuto.saved));
    if (clean) {
      revisionRef.current = next.revision;
      setTaskRows(editableTaskRows(next.task));
      publicAuto.syncServer(toDraft(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

  useDirtyEntry("weekly-goal-public", dirty || conflict, async () => {
    if (conflict) throw new Error("충돌을 먼저 해결해 주세요.");
    await publicAuto.flush();
  }, () => {
    setConflict(false);
    setTaskRows(editableTaskRows(publicAuto.saved.task));
    discardUnsaved(publicAuto); // leave-without-save; F2 core discard() auto-used when present
  }, "주간 목표·PT과제");

  // Undo mirror: the hook restores the pre-save snapshot (previous saved).
  // Track it here so the displayed rows follow the draft — the separate
  // taskRows state used to hide undo.
  const prevSavedTask = useRef(view.current.record.task);
  const lastSavedTask = useRef(view.current.record.task);
  useEffect(() => {
    if (publicAuto.saved.task !== lastSavedTask.current) {
      prevSavedTask.current = lastSavedTask.current;
      lastSavedTask.current = publicAuto.saved.task;
    }
  }, [publicAuto.saved.task]);
  const handleUndo = () => {
    if (!publicAuto.canUndo) return;
    publicAuto.undo();
    setTaskRows(editableTaskRows(prevSavedTask.current));
  };

  /**
   * Conflict overwrite — one user-gated read of the fresh revision, then PUT.
   * The payload is frozen at click: keystrokes typed while the overwrite is
   * in flight stay as newer unsent edits — the ACK below marks only the
   * frozen payload saved (saved=frozen, draft keeps newer). No automatic
   * retry loop; revisionRef takes the newest CAS revision.
   */
  const overwrite = async () => {
    const frozen: PublicDraft = { goals: { ...draftRef.current.goals }, task: draftRef.current.task };
    const frozenParams = goalParamsFromTarget(goalTargetOf(view, "public"));
    publicAuto.stage(frozen);
    setOverwriting(true);
    try {
      const fresh = await goalJSON<WeeklyGoalView>("/api/weekly-goals?" + frozenParams);
      const built = buildPublicPayload(frozen.goals, frozen.task, fresh.current.record.revision);
      if (!built.ok) throw new Error(built.error);
      const result = await goalJSON<{ revision: number }>("/api/weekly-goals?" + frozenParams, built.payload);
      revisionRef.current = result.revision;
      setConflict(false);
      publicAuto.acknowledge(frozen);
      const latest = draftRef.current;
      if (JSON.stringify(latest) !== JSON.stringify(frozen)) {
        const check = buildPublicPayload(latest.goals, latest.task, revisionRef.current);
        if (check.ok) publicAuto.commit();
        else publicAuto.stage(latest, false, check.error);
      }
      window.dispatchEvent(new Event("weekly-goals-saved"));
    } catch (e) {
      if (goalAccessDenied(e)) reload();
      publicAuto.update(draftRef.current, { valid: false, error: (e as Error).message });
    } finally {
      setOverwriting(false);
    }
  };

  const setGoals = (goals: PublicDraft["goals"]) =>
    deferPublic({ goals, task: joinTaskRows(taskRows) });
  const setRows = (rows: string[]) => {
    setTaskRows(rows);
    deferPublic({ goals: publicAuto.draft.goals, task: joinTaskRows(rows) });
  };

  const previousTasks = splitTaskRows(view.previous?.record.task ?? "");
  // Routine inputs stay editable while a save is queued/in-flight — the
  // single-flight/latest-wins coalescer protects newer keystrokes. Only the
  // semantic overwrite mutation disables its own button while running.
  const currentTasks = <GoalTaskRows label="이번 주 PT과제" rows={taskRows}
    onChange={setRows}
    placeholder="과제 하나를 한 줄로 적어 주세요." />;
  return <div className="space-y-5 ph-no-capture">
    {/* 주차 내비게이터 1행 — 페이지 배너 바로 아래에 고정. */}
    <header className="sticky top-app-content z-30 -mx-1 flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2">
      <button type="button" disabled={view.current.week <= 1} onClick={() => guarded(() => changeWeek(view.current.week - 1))}
        className="min-h-11 shrink-0 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">이전 주</button>
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-bold">{view.student.name} · {view.student.cohort} · {view.current.week}주차</p>
        <p className="truncate text-xs text-gray-500">{view.current.start} ~ {view.current.end}</p>
      </div>
      <button type="button" onClick={() => guarded(() => changeWeek(view.current.week + 1))}
        className="min-h-11 shrink-0 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">다음 주</button>
    </header>

    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <GoalRings goals={publicAuto.saved.goals} actuals={view.current.actuals} />
    </section>

    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900">이번 주 목표·PT과제</h2>
        <AutosaveStatus status={publicAuto.status} error={publicAuto.error}
          savedAt={publicAuto.savedAt} onRetry={publicAuto.retry}
          canUndo={publicAuto.canUndo} onUndo={handleUndo} />
      </div>
      {conflict && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        다른 곳에서 먼저 저장됐어요. 입력은 그대로 두었어요.
        <button type="button" disabled={overwriting} onClick={() => { void overwrite(); }}
          className="ml-2 min-h-11 font-bold underline underline-offset-2 disabled:opacity-50">
          {overwriting ? "덮어쓰는 중…" : "내 입력으로 덮어쓰기"}</button>
        <button type="button" onClick={() => guarded(reload)}
          className="ml-2 min-h-11 underline underline-offset-2">최신 내용 불러오기</button>
      </div>}
      {publicAuto.error && !conflict && <p role="alert" className="text-sm text-red-600">{publicAuto.error}</p>}
      <GoalDraftTools cumulative={view.cumulative} weeksCounted={Math.max(0, view.current.week - 1)}
        dirty={dirty} disabled={false} apply={goals => {
          setGoals({ ...publicAuto.draft.goals, ...goals });
        }} />

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
                value={publicAuto.draft.goals[k] ?? ""}
                onChange={e => setGoals({ ...publicAuto.draft.goals, [k]: e.target.value === "" ? null : Number(e.target.value) })}
                className="min-h-11 w-24 rounded-xl border border-gray-300 px-2 text-right text-sm" />
            </td>
          </tr>)}</tbody>
        </table>
      </div>

      {!view.canReadInternal && view.previous && previousTasks.length > 0 && <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-semibold">지난 PT과제</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">{previousTasks.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ol>
      </div>}

      {view.canReadInternal ? <GoalInternalEditor view={view} onDirty={setInternalDirty}
        onRecord={setInternalRecord}>{currentTasks}</GoalInternalEditor> : currentTasks}
    </section>

    {/* 클립보드는 명시적 복사로만 — 저장 후 자동 복사 없음. */}
    <GoalCopyPanel view={{ ...view, current: { ...view.current, record: { ...view.current.record, ...publicAuto.draft } } }}
      internal={internalRecord ?? undefined} dirty={anyDirty || readFailed} />
  </div>;
}
