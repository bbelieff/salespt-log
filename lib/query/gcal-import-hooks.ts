/**
 * React Query 보조 훅 — 화면을 열 때 구글 캘린더에서 직접 넣은 일정을 일반 일정으로 가져온다(gcal-import).
 * 서버가 같은 사용자 1분 안 재호출을 건너뛰므로 화면마다 불러도 된다. 실패는 조용히 무시(화면은 그대로).
 * 새로 들어오거나 바뀐 일정이 있으면 캘린더(month)·주간(week)·할 일(todos) 캐시를 새로 읽게 한다.
 */
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResponse {
  ran?: boolean;
  created?: number;
  updated?: number;
  removed?: number;
}

export function useGcalImportOnMount(enabled: boolean = true): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/gcal/import", { method: "POST" })
      .then((r) => (r.ok ? (r.json() as Promise<ImportResponse>) : null))
      .then((d) => {
        if (!alive || !d?.ran) return;
        if ((d.created ?? 0) + (d.updated ?? 0) + (d.removed ?? 0) === 0) return;
        void qc.invalidateQueries({ queryKey: ["month"] });
        void qc.invalidateQueries({ queryKey: ["week"] });
        void qc.invalidateQueries({ queryKey: ["todos"] });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, qc]);
}
