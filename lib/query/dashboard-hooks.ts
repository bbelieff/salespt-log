/**
 * React Query 훅 — 대시보드 (Recharts 입력).
 * 캐시: ['dashboard'] — 5분 stale.
 *
 * 대시보드는 읽기 전용 (시트 수식 자동 집계). 다른 탭(미팅/계약/DB)에서
 * 쓰기가 일어나도 시트 수식이 즉시 갱신되지 않을 수 있어 5분이 적절.
 * 사용자가 명시적으로 새로고침하면 invalidateQueries(['dashboard']).
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DashboardView } from "@/types";

const dashboardKey = () => ["dashboard"] as const;

async function fetchDashboard(): Promise<DashboardView> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `dashboard fetch ${res.status}`);
  }
  return (await res.json()) as DashboardView;
}

export function useDashboard(): UseQueryResult<DashboardView> {
  return useQuery({
    queryKey: dashboardKey(),
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000,
  });
}
