"use client";
import { useEffect, useRef, useState } from "react";
import type { WeeklyGoalView, WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { goalJSON, goalParams } from "./client";
import { useDirtyEntry } from "@/components/DirtyGuard";
import GoalCopyPanel from "./GoalCopyPanel";

export default function GoalInternalEditor({ view, onDirty, publicDirty }: {
  view: WeeklyGoalView; onDirty: (dirty: boolean) => void; publicDirty: boolean;
}) {
  const url = "/api/weekly-goals/internal?" + goalParams(view);
  const [saved, setSaved] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [draft, setDraft] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const dirty = !!draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const load = async () => {
    try { const data = await goalJSON<WeeklyGoalPrivateRecord>(url); setSaved(data); setDraft(data); setError(""); }
    catch (e) { setError((e as Error).message); }
  };
  useEffect(() => {
    const abort = new AbortController();
    void goalJSON<WeeklyGoalPrivateRecord>(url, undefined, abort.signal).then(data => { setSaved(data); setDraft(data); })
      .catch(e => { if (!abort.signal.aborted) setError((e as Error).message); });
    return () => abort.abort();
  }, [url]);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  async function save() {
    if (!draft || lock.current) throw new Error("저장 중이에요.");
    lock.current = true; setSaving(true); setError("");
    try {
      const result = await goalJSON<{ revision: number }>(url, { specialNotes: draft.specialNotes, priorOutcome: draft.priorOutcome, revision: draft.revision });
      const next = { ...draft, revision: result.revision }; setSaved(next); setDraft(next);
    } catch (e) { setError((e as Error).message); throw e; }
    finally { setSaving(false); lock.current = false; }
  }
  useDirtyEntry("weekly-goal-internal", dirty, save, () => setDraft(saved), "트레이너 내부 기록");
  return <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 ph-no-capture">
    <h2 className="font-bold">트레이너 내부 기록</h2>
    {error && <div role="alert" className="text-sm text-red-600">{error}
      <button type="button" className="ml-2 underline" onClick={() => {
        if (!dirty || window.confirm("입력한 내부 기록을 버리고 최신 내용을 불러올까요?")) void load();
      }}>최신 내용 불러오기</button></div>}
    {!draft ? <p className="text-sm">내부 기록 불러오는 중…</p> :
      <fieldset disabled={saving} className="space-y-3">
        <label className="block text-sm font-semibold">트레이닝 후 특이사항<textarea aria-label="트레이닝 후 특이사항" rows={4} maxLength={10000} value={draft.specialNotes}
          onChange={e => setDraft({ ...draft, specialNotes: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-3" /></label>
        <label className="block text-sm font-semibold">지난주 PT과제 성과<textarea aria-label="지난주 PT과제 성과" rows={4} maxLength={10000} value={draft.priorOutcome}
          onChange={e => setDraft({ ...draft, priorOutcome: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-3" /></label>
        <button type="button" disabled={!dirty || saving} onClick={() => void save().catch(() => {})}
          className="min-h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "내부 기록 저장"}</button>
      </fieldset>}
    {saved && <GoalCopyPanel key={saved.revision + ":" + view.current.record.revision} view={view} internal={saved} dirty={dirty || publicDirty} />}
  </section>;
}
