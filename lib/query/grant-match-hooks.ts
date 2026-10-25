"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GrantMatchesResponse } from "@/lib/analytics/grant-match";

export const grantMatchesKey = () => ["grant-matches"] as const;

/** 계약 업체별 맞는 정책공고 — 실무/수납 목록 칩과 「🎯 맞는 공고」 상자가 같은 캐시를 쓴다. 업체정보 저장 뒤 무효화된다. */
export function useGrantMatches(opts: { enabled?: boolean } = {}) {
  const qc = useQueryClient();
  useEffect(() => {
    const again = () => void qc.invalidateQueries({ queryKey: grantMatchesKey() });
    window.addEventListener("company-info:saved", again);
    return () => window.removeEventListener("company-info:saved", again);
  }, [qc]);
  return useQuery({
    queryKey: grantMatchesKey(),
    queryFn: async (): Promise<GrantMatchesResponse> => {
      const response = await fetch("/api/grant-matches", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "맞는 공고를 불러오지 못했어요.");
      return body;
    },
    enabled: opts.enabled ?? true, staleTime: 10 * 60_000, gcTime: 30 * 60_000, retry: false, meta: { background: true },
  });
}
