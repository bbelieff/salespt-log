"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WeeklyGoalView } from "@/types/weekly-goals";

export class GoalRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const goalAccessDenied = (error: unknown) => error instanceof GoalRequestError && (error.status === 401 || error.status === 403);
export async function goalJSON<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: body === undefined ? "GET" : "PUT", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  let value;
  try { value = await res.json(); }
  catch {
    // Preserve observed transport status even when an auth proxy returns HTML or an empty body.
    throw new GoalRequestError(res.status, res.status === 401 || res.status === 403 ? "접근 권한을 다시 확인해 주세요." : "응답을 확인하지 못했어요. 다시 시도해 주세요.");
  }
  if (!res.ok) throw new GoalRequestError(res.status, typeof value?.error === "string" ? value.error : "다시 시도해 주세요.");
  return value as T;
}
export function goalParams(view: WeeklyGoalView) {
  return new URLSearchParams({ student: view.student.email, week: String(view.current.week),
    enrollment: JSON.stringify([view.student.cohort, view.student.courseStart]) });
}
export function useGoalView(params: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["weekly-goals"] }); };
    // Existing production/contact/meeting mutations refresh the same goal aggregate.
    const unsubscribe = qc.getMutationCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "success") refresh();
    });
    window.addEventListener("weekly-goals-saved", refresh);
    return () => { unsubscribe(); window.removeEventListener("weekly-goals-saved", refresh); };
  }, [qc]);
  return useQuery({
    queryKey: ["weekly-goals", params],
    queryFn: ({ signal }) => goalJSON<WeeklyGoalView>("/api/weekly-goals?" + params, undefined, signal),
    staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: true,
  });
}
