/**
 * React Query 훅 — 대시보드 view.
 * 캐시: ['dashboard'] — 5분 stale.
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
