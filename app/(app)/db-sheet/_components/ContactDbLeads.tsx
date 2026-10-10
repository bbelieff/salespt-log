"use client";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import type { Channel } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";

export default function ContactDbLeads({ date, channel }: { date: string; channel: Channel }) {
  const query = useQuery<{ leads: DbSheetLead[] }>({
    queryKey: ["db-sheet"],
    queryFn: async () => {
      const response = await fetch("/api/db-sheet", { cache: "no-store" });
      if (!response.ok) throw new Error("DB 목록을 불러오지 못했습니다.");
      return response.json();
    }, retry: false,
  });
  const rows = (query.data?.leads ?? []).filter(row => row.channel === channel && row.date <= date);
  if (!rows.length) return null;
  return <details className="rounded-xl border border-slate-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-semibold">DB관리시트 업체 <span className="text-blue-600">{rows.length}</span></summary>
    <div className="mt-2 max-h-64 overflow-auto divide-y divide-slate-100">
      {rows.map(row => <Link key={row.id} href={`/db-sheet?lead=${row.id}` as Route} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-blue-50">
        <span className="min-w-0"><strong className="block truncate">{row.company || row.owner}</strong><span className="text-xs text-slate-500">{row.phone} · 유입 {row.date}</span></span>
        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs">{row.result} ›</span>
      </Link>)}
    </div>
  </details>;
}
