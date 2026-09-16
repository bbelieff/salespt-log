"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { WeeklyGoalView, WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { goalJSON, goalParams, goalAccessDenied } from "./client";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { GoalRequestFence } from "./requestFence";
import { joinAlignedRows, pairPriorOutcomes } from "@/util/weekly-goal-tasks";

export default function GoalInternalEditor({ view, onDirty, onRecord, bindSave, children }: {
  view: WeeklyGoalView;
  children?: ReactNode;
  onDirty: (dirty: boolean) => void;
  /** Latest internal draft, so the single copy panel can build the 회의록 row. */
  onRecord: (record: WeeklyGoalPrivateRecord | null) => void;
  /** Hands the parent this section's save, so one bottom button commits both records. */
  bindSave: (save: (() => Promise<void>) | null) => void;
}) {
  const url = "/api/weekly-goals/internal?" + goalParams(view);
  const [saved, setSaved] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [draft, setDraft] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const fence = useRef(new GoalRequestFence());
  const denied = useRef(false);
  const dirty = !!draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const deny = useCallback(() => {
    denied.current = true;
    fence.current.cancel();
    setSaved(null); setDraft(null);
  }, []);
  const load = useCallback(async () => {
    const request = fence.current.begin();
    try {
      const data = await goalJSON<WeeklyGoalPrivateRecord>(url, undefined, request.signal);
      if (!request.current()) return;
      denied.current = false; setSaved(data); setDraft(data); setError("");
    } catch (e) {
      if (!request.current()) return;
      if (goalAccessDenied(e)) deny();
      setError((e as Error).message);
    }
  }, [url, deny]);
  useEffect(() => {
    const currentFence = fence.current;
    void load();
    return () => currentFence.cancel();
  }, [load]);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { onRecord(draft); return () => onRecord(null); }, [draft, onRecord]);

  const save = useCallback(async () => {
    if (!draft || denied.current) throw new Error("입력과 접근 권한을 확인해 주세요.");
    if (lock.current) throw new Error("저장 중이에요.");
    if (draft.priorOutcome.length > 10000 || draft.specialNotes.length > 10000) {
      setError("기록이 너무 길어요. 10,000자 아래로 줄여 주세요.");
      throw new Error("too long");
    }
    const request = fence.current.begin();
    lock.current = true; setSaving(true); setError("");
    try {
      const result = await goalJSON<{ revision: number }>(url, { specialNotes: draft.specialNotes, priorOutcome: draft.priorOutcome, revision: draft.revision }, request.signal);
      if (!request.current()) throw new Error("최신 내용을 다시 확인해 주세요.");
      const next = { ...draft, revision: result.revision }; setSaved(next); setDraft(next);
    } catch (e) {
      if (request.current()) { if (goalAccessDenied(e)) deny(); setError((e as Error).message); }
      throw e;
    }
    finally { setSaving(false); lock.current = false; }
  }, [draft, url, deny]);
  useEffect(() => {
    bindSave(dirty ? save : null);
    return () => bindSave(null);
  }, [bindSave, save, dirty]);
  useDirtyEntry("weekly-goal-internal", dirty, save, () => { if (!denied.current) setDraft(saved); }, "트레이너 내부 기록");

  const outcomes = draft ? pairPriorOutcomes(view.previous?.record.task ?? "", draft.priorOutcome) : [];
  const setOutcome = (i: number, value: string) => draft && setDraft({
    ...draft,
    priorOutcome: joinAlignedRows(outcomes.map((row, j) => i === j ? value : row.outcome)),
  });
  return <section aria-label="트레이너 내부 기록" className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 ph-no-capture">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">PT과제 성과·트레이너 기록</h2>
      <button type="button" aria-label="내부 기록 최신 내용 불러오기" disabled={saving} className="min-h-11 text-sm underline" onClick={() => {
        if (!dirty || window.confirm("입력한 내부 기록을 버리고 최신 내용을 불러올까요?")) void load();
      }}>최신 내용 불러오기</button>
    </div>
    {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
    {!draft ? (!error && <p className="text-sm">내부 기록 불러오는 중…</p>) :
      <fieldset disabled={saving} className="space-y-3">
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
    {draft && <fieldset disabled={saving}>
        <label className="block text-sm font-semibold">트레이닝 후 특이사항<textarea aria-label="트레이닝 후 특이사항" rows={4} maxLength={10000} value={draft.specialNotes}
          onChange={e => setDraft({ ...draft, specialNotes: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-3" /></label>
      </fieldset>}
  </section>;
}
