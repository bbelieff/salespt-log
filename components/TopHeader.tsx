/**
 * TopHeader — 모든 (app) 탭 상단 공통 헤더.
 *
 * 구성 (1줄, h-12):
 *   [로고 png] [경영일지] [D-day] [{기수} {이름} 대표님]
 *
 * 로고는 /public/salespt-logo.png — 워드마크가 이미 포함되어 있어서
 * "세일즈PT" 텍스트는 별도 표시하지 않고 "경영일지"만 표기.
 *
 * 사용처: contact / schedule / calendar / payment / db 5개 페이지.
 * 데이터: useMe() 훅이 시트 01 영업관리!B3/C3/N1 SSOT에서 가져옴.
 */
"use client";

import { useMe } from "@/query/me-hook";
import DDayBadge from "./DDayBadge";

interface Props {
  pageEmoji: string; // 예: "💰"
  pageTitle: string; // 예: "계약수납"
  pageSubtitle?: string; // 우측 보조 텍스트 (예: "02 계약수납관리")
}

/** 시트 B3가 "7"이면 "7기"로, "7기"면 그대로 유지. */
function formatCohort(cohort: string): string {
  const trimmed = cohort.trim();
  if (!trimmed) return "";
  return /기\s*$/.test(trimmed) ? trimmed : `${trimmed}기`;
}

/** "7기 김믿음 대표님" — 비어있으면 "—". */
function formatDisplay(cohort: string, name: string): string {
  const c = formatCohort(cohort);
  const n = name.trim();
  if (!c && !n) return "—";
  if (!n) return c;
  if (!c) return `${n} 대표님`;
  return `${c} ${n} 대표님`;
}

export default function TopHeader({
  pageEmoji,
  pageTitle,
  pageSubtitle,
}: Props) {
  const me = useMe();
  const display = formatDisplay(me.data?.cohort ?? "", me.data?.name ?? "");

  return (
    <>
      {/* 슬림 브랜드 바 (1줄: 로고 / 경영일지 / D-day / 사용자) */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-2 border-b border-gray-100 bg-white px-3">
        {/* 좌: 로고 + 경영일지 */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/salespt-logo.png"
            alt="세일즈PT"
            className="h-7 w-auto object-contain"
          />
          <span className="truncate text-xs font-semibold text-gray-900 sm:text-sm">
            경영일지
          </span>
        </div>

        {/* 중앙: D-day 카운터 */}
        <div className="flex shrink-0 justify-center">
          <DDayBadge weekTargetISO={me.data?.weekTargetISO} />
        </div>

        {/* 우: 사용자 */}
        <div className="flex min-w-0 justify-end">
          <span className="truncate text-xs font-bold text-gray-900 sm:text-sm">
            {display}
          </span>
        </div>
      </header>

      {/* 페이지 배너 */}
      <div className="sticky top-12 z-40 flex h-12 items-center gap-3 border-b border-slate-200 bg-slate-100 px-4">
        <div className="h-5 w-1 rounded-sm bg-slate-500" />
        <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-base leading-none">{pageEmoji}</span>
          <span>{pageTitle}</span>
        </h1>
        {pageSubtitle && (
          <span className="ml-auto text-xs text-slate-500">{pageSubtitle}</span>
        )}
      </div>
    </>
  );
}
