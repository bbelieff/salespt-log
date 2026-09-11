"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { goalJSON } from "./client";
import { GOAL_KEYS, GOAL_LABELS, type GoalOverviewRow } from "@/types/weekly-goals";
import { useState } from "react";
import WeeklyGoalSummary from "./WeeklyGoalSummary";

export default function TrainerGoalOverview() {
  const [selected, setSelected] = useState("");
  const q = useQuery({ queryKey: ["weekly-goal-students"], queryFn: () => goalJSON<GoalOverviewRow[]>("/api/weekly-goals/overview"), staleTime: 0, gcTime: 0, retry: false });
  return <main className="min-h-dvh bg-gray-50 p-4"><div className="mx-auto max-w-5xl space-y-4">
    <Link className="inline-block px-3 py-3 text-sm" href="/trainer">← 수강생 관리</Link>
    <h1 className="text-2xl font-bold">담당 수강생 주간 목표</h1>
    {q.isPending ? <p role="status">담당 수강생을 불러오는 중…</p> : q.isError ?
      <p role="alert">{q.error.message}</p> :
      <><p className="text-sm text-gray-500">담당 {q.data.length}명 · 이번 주 저장 {q.data.filter(u => u.record && u.record.revision > 0).length}명 · 확인 필요 {q.data.filter(u => u.error).length}명</p>
        <div className="flex flex-wrap gap-2">{q.data.map(u => <button key={u.email + u.cohort}
          onClick={() => setSelected(u.email)} aria-pressed={selected === u.email}
          className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${selected === u.email ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
          {u.name} · {u.cohort}</button>)}</div>
        {q.data.length === 0 && <p>배정된 수강생이 없어요.</p>}
        {selected && <WeeklyGoalSummary key={selected} student={selected} />}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm">
          <thead><tr><th className="p-3">수강생</th><th className="p-3">주차</th>{GOAL_KEYS.map(k => <th key={k} className="p-3">{GOAL_LABELS[k]}</th>)}<th className="p-3">PT과제</th></tr></thead>
          <tbody>{q.data.map(u => <tr key={u.email + u.cohort} className="border-t">
            <th className="p-3"><Link href={{ pathname: "/weekly-goals", query: { student: u.email } }} className="text-blue-700 underline">{u.name} · {u.cohort}</Link></th>
            <td className="p-3">{u.week ?? "—"}</td>
            {GOAL_KEYS.map(k => <td key={k} className="p-3">{u.record?.goals[k] ?? "—"}</td>)}
            <td className="p-3 whitespace-pre-wrap">{u.error || u.record?.task || "미기재"}</td>
          </tr>)}</tbody></table></div>
        <p className="text-xs text-gray-500">{GOAL_KEYS.map(k => GOAL_LABELS[k]).join(" · ")}</p>
      </>}
  </div></main>;
}
