"use client";
/** 대시보드 「오늘 챙길 일」 상자 맨 아래 한 줄 — 모은 배지 수 + 다음 배지까지 남은 양(또는 새 배지). 누르면 /badges. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBadges } from "@/query/badge-hooks";
import { useMe } from "@/query/me-hook";
import { todayKST } from "@/util/week";
import { BADGES_SEEN_EVENT, newBadgeIds, readSeen } from "./badge-seen";
import { chipModel, type ChipModel } from "./badge-next";
import "./badge-medal.css";

export default function BadgeChip() {
  const me = useMe();
  const q = useBadges({ enabled: !!me.data?.email });
  const who = me.data?.email ?? "";
  const list = Array.isArray(q.data?.badges) ? q.data.badges : null;
  const [model, setModel] = useState<ChipModel | null>(null);
  useEffect(() => {
    if (!list) return;
    const recompute = () => setModel(chipModel(list, newBadgeIds(list, readSeen(who), todayKST())));
    recompute();
    window.addEventListener(BADGES_SEEN_EVENT, recompute);
    return () => window.removeEventListener(BADGES_SEEN_EVENT, recompute);
  }, [list, who]);
  if (!model) return null; // 불러오는 중·실패는 자리를 비운다(상자 높이 흔들림 없음 — 맨 아래 한 줄)

  const fresh = model.kind === "new";
  return (
    <Link href="/badges" data-badge-chip={model.kind}
      aria-label={`배지 ${model.got}/${model.total}개 · ${model.text} · 배지 수집 열기`}
      className={`mt-3 flex min-h-12 items-center gap-2.5 rounded-xl border py-2 pl-2 pr-3 text-gray-900 transition-colors ${fresh ? "border-orange-300 bg-orange-50 hover:bg-orange-100" : "border-amber-200 bg-amber-50 hover:bg-amber-100"}`}>
      <span className="badge-chip-icon" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/badges/${model.img}.png`} alt="" />
        {fresh && <span className="badge-chip-dot" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {/* 좁은 화면은 줄바꿈 — 남은 양(「7일」)이 잘리지 않게 */}
        <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-snug">
          <span className="shrink-0 whitespace-nowrap">배지 <b className="font-black tabular-nums">{model.got}</b>/{model.total}</span>
          <span className="shrink-0 text-amber-400" aria-hidden="true">·</span>
          <span className={`break-keep ${fresh ? "font-extrabold text-orange-700" : "font-semibold text-gray-700"}`}>{model.text}</span>
        </span>
        <span className={`badge-meter ${fresh ? "badge-meter--total" : "badge-meter--next"}`} aria-hidden="true"><i style={{ width: `${fresh ? Math.round((model.got / model.total) * 100) : model.pct}%` }} /></span>
      </span>
      <span className="shrink-0 text-lg text-amber-700" aria-hidden="true">›</span>
    </Link>
  );
}
