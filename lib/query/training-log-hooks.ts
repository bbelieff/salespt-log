/** 트레이닝일지 (belie 2026-10-30) — 내 일지 목록과 한 편. 서버가 노션에서 자기 것만 골라 준다. */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { TrainingLogDetail, TrainingLogList } from "@/types/training-log";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `training-log ${res.status}`), { status: res.status });
  return body as T;
}

export function useTrainingLogs() {
  return useQuery({
    queryKey: ["training-log"],
    queryFn: () => fetch("/api/training-log", { cache: "no-store" }).then(r => json<TrainingLogList>(r)),
    staleTime: 5 * 60_000, retry: 1,
  });
}

export function useTrainingLog(id: string) {
  return useQuery({
    queryKey: ["training-log", id],
    queryFn: () => fetch(`/api/training-log/${encodeURIComponent(id)}`, { cache: "no-store" }).then(r => json<TrainingLogDetail>(r)),
    staleTime: 5 * 60_000,
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 1,
  });
}
