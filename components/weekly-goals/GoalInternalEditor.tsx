"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WeeklyGoalView, WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { goalJSON, goalParams, goalAccessDenied } from "./client";
import { useDirtyEntry } from "@/components/DirtyGuard";
import GoalCopyPanel from "./GoalCopyPanel";
import { GoalRequestFence } from "./requestFence";

export default function GoalInternalEditor({ view, onDirty, publicDirty }: {
  view: WeeklyGoalView; onDirty: (dirty: boolean) => void; publicDirty: boolean;
}) {
  const url = "/api/weekly-goals/internal?" + goalParams(view);
  const [saved, setSaved] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [draft, setDraft] = useState<WeeklyGoalPrivateRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const fence = useRef(new GoalRequestFence());
  const denied = useRef(false);
  const dirty = !!draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const deny = useCallback(() => {
    denied.current = true;
    fence.current.cancel();
    setSaved(null); setDraft(null); setMessage("");
  }, []);
  const load = useCallback(async () => {
    const request = fence.current.begin();
    try {
      const data = await goalJSON<WeeklyGoalPrivateRecord>(url, undefined, request.signal);
      if (!request.current()) return;
      denied.current = false; setSaved(data); setDraft(data); setError(""); setMessage("");
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
  async function save() {
    if (!draft || denied.current || lock.current) throw new Error("입력과 접근 권한을 확인해 주세요.");
    const request = fence.current.begin();
    lock.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const result = await goalJSON<{ revision: number }>(url, { specialNotes: draft.specialNotes, priorOutcome: draft.priorOutcome, revision: draft.revision }, request.signal);
      if (!request.current()) throw new Error("최신 내용을 다시 확인해 주세요.");
      const next = { ...draft, revision: result.revision }; setSaved(next); setDraft(next);
      setMessage("성과·기록을 저장했어요.");
    } catch (e) {
      if (request.current()) { if (goalAccessDenied(e)) deny(); setError((e as Error).message); }
      throw e;
    }
    finally { setSaving(false); lock.current = false; }
  }
  useDirtyEntry("weekly-goal-internal", dirty, save, () => { if (!denied.current) setDraft(saved); }, "트레이너 내부 기록");
  return <section aria-label="트레이너 내부 기록" className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 ph-no-capture">
    <h2 className="font-bold">PT과제 성과·트레이너 기록</h2>
    {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      <button type="button" aria-label="내부 기록 최신 내용 불러오기" disabled={saving} className="min-h-11 text-sm underline" onClick={() => {
        if (!dirty || window.confirm("입력한 내부 기록을 버리고 최신 내용을 불러올까요?")) void load();
      }}>최신 내용 불러오기</button>
    {!draft ? (!error && <p className="text-sm">내부 기록 불러오는 중…</p>) :
      <fieldset disabled={saving} className="space-y-3">
        {view.previous && <label className="block text-sm font-semibold">{view.previous.week}주차 PT과제 성과
          <textarea aria-label="지난주 PT과제 성과" rows={3} maxLength={10000} value={draft.priorOutcome}
            placeholder="실행한 내용, 결과, 다음에 보완할 점을 기록해 주세요."
            onChange={e => { setDraft({ ...draft, priorOutcome: e.target.value }); setMessage(""); }} className="mt-1 w-full rounded-xl border border-gray-300 p-3" />
        </label>}
        <label className="block text-sm font-semibold">트레이닝 후 특이사항<textarea aria-label="트레이닝 후 특이사항" rows={4} maxLength={10000} value={draft.specialNotes}
          onChange={e => { setDraft({ ...draft, specialNotes: e.target.value }); setMessage(""); }} className="mt-1 w-full rounded-xl border border-gray-300 p-3" /></label>
        <button type="button" disabled={!dirty || saving} onClick={() => void save().catch(() => {})}
          className="min-h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "성과·기록 저장"}</button>
      </fieldset>}
    <p role="status" className="text-sm text-gray-600">{message}</p>
    {saved && <GoalCopyPanel key={saved.revision + ":" + view.current.record.revision} view={view} internal={saved} dirty={dirty || publicDirty || !!error} />}
  </section>;
}
