"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { WeeklyGoalView, WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { goalJSON, goalParams, goalAccessDenied } from "./client";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { GoalRequestFence } from "./requestFence";
import { buildInternalPayload, discardUnsaved, goalParamsFromTarget, goalTargetOf } from "@/components/weekly-goals/weeklyGoalAutosave";
import { joinAlignedRows, pairPriorOutcomes } from "@/util/weekly-goal-tasks";

interface InternalDraft {
  specialNotes: string;
  priorOutcome: string;
}

const toDraft = (record: WeeklyGoalPrivateRecord): InternalDraft => ({
  specialNotes: record.specialNotes,
  priorOutcome: record.priorOutcome,
});

export default function GoalInternalEditor({ view, onDirty, onRecord, children }: {
  view: WeeklyGoalView;
  children?: ReactNode;
  onDirty: (dirty: boolean) => void;
  /** Latest internal draft, so the single copy panel can build the 회의록 row. */
  onRecord: (record: WeeklyGoalPrivateRecord | null) => void;
}) {
  const url = "/api/weekly-goals/internal?" + goalParams(view);
  const revisionRef = useRef(0);
  const [loaded, setLoaded] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [overwriting, setOverwriting] = useState(false);
  const fence = useRef(new GoalRequestFence());
  const denied = useRef(false);

  const deny = useCallback(() => {
    denied.current = true;
    fence.current.cancel();
    setLoaded(null);
  }, []);

  const auto = useAutosave<InternalDraft>({
    target: goalTargetOf(view, "internal"),
    initial: { specialNotes: "", priorOutcome: "" },
    delayMs: 800,
    // Bound to the CAPTURED queue target — never the live view URL, so a
    // debounced save scheduled on week N still PUTs week N after a switch.
    save: async ({ target, payload }) => {
      if (denied.current) throw new Error("입력과 접근 권한을 확인해 주세요.");
      const built = buildInternalPayload(payload.specialNotes, payload.priorOutcome, revisionRef.current);
      if (!built.ok) throw new Error(built.error);
      const boundUrl = "/api/weekly-goals/internal?" + goalParamsFromTarget(target);
      const request = fence.current.begin();
      try {
        const result = await goalJSON<{ revision: number }>(boundUrl, built.payload, request.signal);
        if (!request.current()) throw new Error("최신 내용을 다시 확인해 주세요.");
        revisionRef.current = result.revision;
      } catch (e) {
        if (!request.current()) throw new Error("최신 내용을 다시 확인해 주세요.");
        if ((e as { status?: number }).status === 409) {
          setConflict(true);
          throw new Error("다른 곳에서 먼저 저장됐어요. 입력은 그대로 두었어요.");
        }
        if (goalAccessDenied(e)) deny();
        throw e;
      }
    },
  });

  // Latest draft mirror: overwrite failure must retain CURRENT text.
  const draftRef = useRef(auto.draft);
  draftRef.current = auto.draft;

  // While conflict/overwrite: editable, but stage (no schedule/retry).
  const deferInternal = (next: InternalDraft) => {
    if (conflict || overwriting) auto.stage(next);
    else auto.update(next);
  };

  const load = useCallback(async () => {
    const request = fence.current.begin();
    try {
      const data = await goalJSON<WeeklyGoalPrivateRecord>(url, undefined, request.signal);
      if (!request.current()) return;
      denied.current = false;
      revisionRef.current = data.revision;
      setLoaded(data);
      auto.syncServer(toDraft(data));
      setError("");
      setConflict(false);
    } catch (e) {
      if (!request.current()) return;
      if (goalAccessDenied(e)) deny();
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, deny]);
  useEffect(() => {
    const currentFence = fence.current;
    void load();
    return () => currentFence.cancel();
  }, [load]);

  const dirty = auto.dirty || conflict;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => {
    onRecord(loaded ? { ...loaded, ...auto.draft, revision: revisionRef.current } : null);
    return () => onRecord(null);
  }, [loaded, auto.draft, onRecord]);

  useDirtyEntry("weekly-goal-internal", dirty, async () => {
    if (conflict) throw new Error("충돌을 먼저 해결해 주세요.");
    await auto.flush();
  }, () => {
    if (!denied.current && loaded) {
      setConflict(false);
      discardUnsaved(auto); // leave-without-save; F2 core discard() auto-used when present
    }
  }, "트레이너 내부 기록");

  /**
   * Conflict overwrite — one user-gated read of the fresh revision, then PUT.
   * Frozen at click: the ACK marks only the frozen payload saved (newer
   * keystrokes stay unsent). No automatic retry loop; newest CAS kept.
   */
  const overwrite = async () => {
    const frozen: InternalDraft = { specialNotes: draftRef.current.specialNotes, priorOutcome: draftRef.current.priorOutcome };
    const frozenUrl = url;
    auto.stage(frozen);
    setOverwriting(true);
    try {
      const fresh = await goalJSON<WeeklyGoalPrivateRecord>(frozenUrl);
      const built = buildInternalPayload(frozen.specialNotes, frozen.priorOutcome, fresh.revision);
      if (!built.ok) throw new Error(built.error);
      const result = await goalJSON<{ revision: number }>(frozenUrl, built.payload);
      revisionRef.current = result.revision;
      setLoaded({ ...fresh, ...frozen, revision: result.revision });
      setConflict(false);
      auto.acknowledge(frozen);
      const latest = draftRef.current;
      if (JSON.stringify(latest) !== JSON.stringify(frozen)) {
        const check = buildInternalPayload(latest.specialNotes, latest.priorOutcome, revisionRef.current);
        if (check.ok) auto.commit();
        else auto.stage(latest, false, check.error);
      }
    } catch (e) {
      if (goalAccessDenied(e)) deny();
      auto.update(draftRef.current, { valid: false, error: (e as Error).message });
    } finally {
      setOverwriting(false);
    }
  };

  const outcomes = pairPriorOutcomes(view.previous?.record.task ?? "", auto.draft.priorOutcome);
  const setOutcome = (i: number, value: string) => deferInternal({
    ...auto.draft,
    priorOutcome: joinAlignedRows(outcomes.map((row, j) => i === j ? value : row.outcome)),
  });
  // Routine inputs stay editable while a save is queued/in-flight — only the
  // semantic overwrite mutation disables its own button while running.
  return <section aria-label="트레이너 내부 기록" className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 ph-no-capture">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">PT과제 성과·트레이너 기록</h2>
      <span className="inline-flex items-center gap-2">
        <AutosaveStatus status={auto.status} error={auto.error}
          savedAt={auto.savedAt} onRetry={auto.retry}
          canUndo={auto.canUndo} onUndo={auto.undo} />
        <button type="button" aria-label="내부 기록 최신 내용 불러오기" className="min-h-11 text-sm underline" onClick={() => {
          if (!dirty || window.confirm("입력한 내부 기록을 버리고 최신 내용을 불러올까요?")) void load();
        }}>최신 내용 불러오기</button>
      </span>
    </div>
    {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
    {conflict && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      다른 곳에서 먼저 저장됐어요. 입력은 그대로 두었어요.
      <button type="button" disabled={overwriting} onClick={() => { void overwrite(); }}
        className="ml-2 min-h-11 font-bold underline underline-offset-2 disabled:opacity-50">
        {overwriting ? "덮어쓰는 중…" : "내 입력으로 덮어쓰기"}</button>
    </div>}
    {auto.error && !conflict && <div role="alert" className="text-sm text-red-600">{auto.error}</div>}
    {!loaded ? (!error && <p className="text-sm">내부 기록 불러오는 중…</p>) :
      <fieldset className="space-y-3">
        {view.previous && <div className="space-y-2">
          <p className="text-sm font-semibold">{view.previous.week}주차 PT과제 성과</p>
          {outcomes.map((row, i) => <label key={i} className="grid items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm pc:grid-cols-2">
            <span className="break-words font-medium">{i + 1}. {row.task || "과제 기록 없음"}</span>
            <textarea aria-label={`지난주 PT과제 성과 ${i + 1}번`} rows={2} maxLength={2000} value={row.outcome}
              placeholder="실행한 내용, 결과, 다음에 보완할 점을 기록해 주세요."
              onChange={e => setOutcome(i, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 p-3" />
          </label>)}
        </div>}
      </fieldset>}
    {children}
    {loaded && <fieldset>
        <label className="block text-sm font-semibold">트레이닝 후 특이사항<textarea aria-label="트레이닝 후 특이사항" aria-describedby="goal-internal-special-notes-help" rows={4} maxLength={10000} value={auto.draft.specialNotes}
          placeholder={"예: 컨택 스크립트 보완 필요\n예: 다음 주 미팅 준비 점검"}
          onChange={e => deferInternal({ ...auto.draft, specialNotes: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-3" /></label>
        <p id="goal-internal-special-notes-help" className="text-xs text-gray-500">내용별로 줄을 나눠 작성해 주세요. 입력한 줄바꿈은 복사할 때도 유지됩니다.</p>
      </fieldset>}
  </section>;
}
