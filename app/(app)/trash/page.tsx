/**
 * /trash — 앱 휴지통(2026-10-28 belie 「앱 전체 한 곳, 깔끔한 표, 행 골라 되살리기만」).
 * 지운 할 일·미팅·DB관리시트를 한 표에 모아 행을 골라 되살린다. 영구 삭제는 없다.
 * 진입: 왼쪽 위 로고 메뉴 「휴지통」. 데이터·규칙은 lib/service/trash.ts.
 */
"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import TrashTable from "./_components/TrashTable";
import type { TrashItem, TrashKind, TrashRestoreResult } from "@/service/trash";

const KIND_FILTERS: { id: TrashKind | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "todo", label: "할 일" },
  { id: "meeting", label: "미팅" },
  { id: "lead", label: "DB관리시트" },
];
const keyOf = (i: { kind: TrashKind; id: string }) => `${i.kind}:${i.id}`;

export default function TrashPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["trash"],
    queryFn: async () => {
      const res = await fetch("/api/trash", { cache: "no-store" });
      if (!res.ok) throw new Error("휴지통을 불러오지 못했어요.");
      return (await res.json()) as { items: TrashItem[]; canRestore: boolean };
    },
  });
  const [filter, setFilter] = useState<TrashKind | "all">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const shown = useMemo(() => (filter === "all" ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const pickedItems = items.filter((i) => picked.has(keyOf(i)) && !i.blocked);

  const toggle = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = (keys: string[], on: boolean) => setPicked((p) => { const n = new Set(p); keys.forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });

  const restore = async () => {
    if (!pickedItems.length || busy) return;
    setBusy(true); setNotice(null);
    try {
      const res = await fetch("/api/trash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: pickedItems.map(({ kind, id }) => ({ kind, id })) }) });
      const body = (await res.json()) as TrashRestoreResult & { error?: string };
      if (!res.ok) throw new Error(body.error || "되살리지 못했어요.");
      setPicked(new Set());
      setNotice(body.failed.length
        ? { tone: "warn", text: `${body.restored}개 되살렸어요 · ${body.failed.length}개는 못 했어요 (${[...new Set(body.failed.map((f) => f.reason))].join(", ")})` }
        : { tone: "ok", text: `${body.restored}개를 되살렸어요. 원래 화면에서 다시 보여요.` });
      // 되살린 것이 원래 화면(실무/수납·일정·DB관리시트·대시보드)에 바로 보이게 전부 새로 읽는다.
      await qc.invalidateQueries();
    } catch (e) {
      setNotice({ tone: "warn", text: e instanceof Error ? e.message : "되살리지 못했어요." });
    } finally { setBusy(false); }
  };

  return (
    <>
      <TopHeader pageEmoji="🗑️" pageTitle="휴지통" pageSubtitle="지운 기록 되살리기" />
      <PageContainer width="narrow">
        <div className="space-y-3 px-4 py-4 pc:px-0">
          <p className="text-sm text-slate-600">지운 할 일·미팅·DB관리시트 기록이에요. 줄을 골라 <b className="text-slate-800">되살리기</b>를 누르면 원래 자리로 돌아가요.</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="종류">
            {KIND_FILTERS.map((f) => {
              const n = f.id === "all" ? items.length : items.filter((i) => i.kind === f.id).length;
              return <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${filter === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{f.label} <span className="tabular-nums opacity-70">{n}</span></button>;
            })}
          </div>
          {notice && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{notice.text}</p>}
          {list.isPending ? <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="fx-skeleton h-11 rounded-lg" />)}</div>
            : list.isError ? <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">휴지통을 불러오지 못했어요. <button type="button" onClick={() => void list.refetch()} className="font-semibold underline">다시 시도</button></p>
            : shown.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center"><p className="text-sm font-semibold text-slate-700">휴지통이 비어 있어요</p><p className="mt-1 text-xs text-slate-500">지운 기록이 생기면 여기에 모여요.</p></div>
            : <TrashTable items={shown} picked={picked} canRestore={!!list.data?.canRestore} onToggle={toggle} onToggleAll={toggleAll} keyOf={keyOf} />}
          {list.data?.canRestore && items.length > 0 && (
            <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
              <span className="text-sm text-slate-600"><b className="tabular-nums text-slate-900">{pickedItems.length}</b>개 골랐어요</span>
              <button type="button" disabled={!pickedItems.length || busy} onClick={() => void restore()} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition-transform hover:bg-blue-700 active:scale-95 disabled:opacity-40">{busy ? "되살리는 중…" : "되살리기"}</button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
