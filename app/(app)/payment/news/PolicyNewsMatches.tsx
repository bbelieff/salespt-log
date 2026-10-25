/**
 * 정책자금 데일리 위 한 줄 상자 「🎯 내 업체에 맞는 공고 N」(2026-10-26 맞춤공고 4c — belie 승인 목업 ③).
 * 원래 뉴스 화면(iframe)은 그대로 두고, 맞는 공고만 보여 뉴스 전체를 두 번 보여 주지 않는다.
 * 공고 줄을 펼치면 맞는 업체가 아래에 — 담았으면 「담음」 표시만. 담기는 실무/수납에서(핸드오프 §4-C).
 */
"use client";

import Link from "next/link";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import { useGrantMatches } from "@/query/grant-match-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { grantIdOfTodo, isGrantTodo } from "@/lib/analytics/todo-slot";
import { contractRef, normalizeContractRef } from "@/util/contract-ref";

export default function PolicyNewsMatches() {
  const { data } = useGrantMatches();
  const todos = useAllTodos({ background: true }).data?.todos ?? [];
  const rows = useContractPayments().data?.rows ?? [];
  if (!data || data.unavailable) return null;

  const taken = new Set(todos.filter(isGrantTodo).map((t) => `${normalizeContractRef(t.contractRef)}#${grantIdOfTodo(t)}`));
  const rowOf = new Map(rows.map((cp) => [contractRef(cp.계약일, cp.업체명), cp.row]));
  const byAnnouncement = new Map<string, { ref: string; name: string; urgent: boolean; taken: boolean }[]>();
  for (const [ref, c] of Object.entries(data.companies)) {
    for (const m of c.matches) {
      const list = byAnnouncement.get(m.id) ?? [];
      list.push({ ref, name: ref.slice(ref.indexOf("|") + 1), urgent: m.urgent, taken: taken.has(`${ref}#${m.id}`) });
      byAnnouncement.set(m.id, list);
    }
  }
  const items = [...byAnnouncement.entries()]
    .filter(([id]) => data.announcements[id])
    .sort(([a], [b]) => data.announcements[b]!.lastSeen.localeCompare(data.announcements[a]!.lastSeen));
  if (items.length === 0) return null;

  return (
    <details data-policy-news-matches className="group mb-3 rounded-lg border border-slate-200 bg-white pc:shrink-0">
      <summary className="disclosure-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-800">
        <span>🎯 내 업체에 맞는 공고 {items.length}</span>
        <DisclosureChevron />
      </summary>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
        {items.map(([id, companies]) => {
          const a = data.announcements[id]!;
          const line = [a.regionText, a.maxAmount, a.deadlineText && `마감 ${a.deadlineText}`].filter(Boolean).join(" · ");
          return (
            <li key={id}>
              <details className="group/row">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{a.title}</span>
                    {line && <span className="block truncate text-px-11 text-slate-500">{line}</span>}
                  </span>
                  <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-px-11 font-bold text-emerald-700 ring-1 ring-emerald-200">업체 {companies.length}</span>
                </summary>
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {companies.map((c) => {
                    const row = rowOf.get(c.ref);
                    const label = <>{c.name}{c.taken && <span className="ml-1 text-px-10 font-bold text-slate-500">담음</span>}</>;
                    const cls = `inline-flex min-h-7 items-center rounded-full border px-2 text-xs font-semibold ${c.taken ? "border-slate-200 bg-slate-50 text-slate-500" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`;
                    return row != null
                      ? <Link key={c.ref} href={`/payment?row=${row}`} className={cls}>{label}</Link>
                      : <span key={c.ref} className={cls}>{label}</span>;
                  })}
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="ml-auto self-center text-xs font-semibold text-blue-700 hover:underline">공고 원문 →</a>}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
