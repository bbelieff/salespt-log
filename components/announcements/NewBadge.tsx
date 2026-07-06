/**
 * NewBadge — 앱 내 새 기능 위치 표시 래퍼 (new-feature-highlight §2, components.md §4).
 *
 * /api/announcements 의 activeAnchor(visible feat 중 anchor 있는 최신 1건, 상한 14일)와
 * anchorKey 가 일치할 때만 children 뒤에 "NEW" 필을 인라인 append — 레이아웃 밀림 최소.
 * 위치 뱃지는 활성 기간 동안 유지(개인 해제 없음 — 해제는 TabBar 점만, SoR §2).
 * 데이터는 useAnnouncements 공유(react-query dedupe) — 추가 네트워크 비용 0.
 */
"use client";

import type { ReactNode } from "react";
import { useAnnouncements } from "@/query/announcements-hook";

export default function NewBadge({
  anchorKey,
  children,
}: {
  /** lib/config/anchors.ts ANCHORS 에 등록된 키 (코드 상수가 정본). */
  anchorKey: string;
  children?: ReactNode;
}) {
  const q = useAnnouncements();
  const active = q.data?.activeAnchor?.key === anchorKey;
  return (
    <>
      {children}
      {active && (
        <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-brand-red px-1.5 text-xs font-bold leading-tight text-white">
          NEW
        </span>
      )}
    </>
  );
}
