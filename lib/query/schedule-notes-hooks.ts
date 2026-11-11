/** React Query 훅 — 일정 보드 일별 메모·주간 이슈(/api/schedule-notes). 표가 없으면(503) 읽기 실패 → 화면이 「저장 불가」로 보인다. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScheduleNotePut, ScheduleNotesView } from "@/types";

const ROOT = ["schedule-notes"] as const;
export const scheduleNotesKey = (from: string, issuesWeek: string) => [...ROOT, from, issuesWeek] as const;

async function fetchNotes(from: string, issuesWeek: string): Promise<ScheduleNotesView> {
  const res = await fetch(`/api/schedule-notes?from=${from}&issuesWeek=${issuesWeek}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ScheduleNotesView;
}

export function useScheduleNotes(from: string, issuesWeek: string) {
  return useQuery({ queryKey: scheduleNotesKey(from, issuesWeek), queryFn: () => fetchNotes(from, issuesWeek), retry: false, meta: { background: true } });
}

/** 저장 — 보이는 캐시에 먼저 반영하고, 실패하면 다시 읽어 되돌린다. */
export function useSaveScheduleNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleNotePut) => {
      const res = await fetch("/api/schedule-notes", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onMutate: (input) => {
      // 이슈는 같은 수강 주(키의 issuesWeek)인 캐시에만, 메모는 날짜 칸이라 어느 캐시에 넣어도 그 날짜에만 보인다.
      const match = input.kind === "issues" ? { predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === ROOT[0] && q.queryKey[2] === input.weekStart } : { queryKey: ROOT };
      qc.setQueriesData<ScheduleNotesView>(match, (old) => {
        if (!old) return old;
        if (input.kind === "issues") return { ...old, issues: input.issues };
        const memos = { ...old.memos };
        if (input.text) memos[input.date] = input.text;
        else delete memos[input.date];
        return { ...old, memos };
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}
