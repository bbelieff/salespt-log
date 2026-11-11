"use client";
/**
 * 관리 화면 수강생 이름 옆 「첫걸음 N/7」(2026-11-11 첫걸음 2차) — 아직 다 안 한 수강생만, 기록이 있을 때만.
 * 진행 지도는 화면당 한 번만 부른다(모듈 캐시). 관리 권한이 없거나 표가 없으면 빈 지도 → 아무것도 안 그린다.
 */
import { useEffect, useState } from "react";
import type { FirstStepsProgressMap } from "@/types";

let pending: Promise<FirstStepsProgressMap | null> | null = null;
function loadProgress(): Promise<FirstStepsProgressMap | null> {
  pending ??= fetch("/api/admin/first-steps")
    .then((res) => (res.ok ? (res.json() as Promise<FirstStepsProgressMap>) : null))
    .catch(() => null);
  return pending;
}

export default function FirstStepsBadge({ email }: { email: string }) {
  const [map, setMap] = useState<FirstStepsProgressMap | null>(null);
  useEffect(() => {
    let live = true;
    void loadProgress().then((m) => {
      if (live) setMap(m);
    });
    return () => {
      live = false;
    };
  }, []);
  const n = map?.byEmail[email.trim().toLowerCase()];
  const total = map?.total ?? 7;
  if (n === undefined || n >= total) return null;
  return (
    <span className="ml-1.5 shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-xs font-semibold text-amber-800" title="새 수강생 첫걸음 진행">
      첫걸음 {n}/{total}
    </span>
  );
}
