/**
 * TopHeader — 모든 (app) 탭 상단 공통 헤더.
 *
 * 구성 (1줄, h-12):
 *   [로고 png] [경영일지] [D-day] [{기수} {이름} 대표님]
 *
 * 로고는 /public/salespt-logo.png — 워드마크가 이미 포함되어 있어서
 * "세일즈PT" 텍스트는 별도 표시하지 않고 "경영일지"만 표기.
 *
 * 반응형 (display-reference-v2.html 기준):
 *   - xs(360, Galaxy): "경영일지" 숨김 (로고 워드마크에 이미 포함) + 폰트 축소
 *   - sm(390, iPhone 12~16/17e): "경영일지" 표시 + sm 폰트
 *   - md+(402+, iPhone 17/Pro/Pro Max): 동일 (여유 있음)
 *
 * 사용처: contact / schedule / calendar / payment / db 5개 페이지.
 */
"use client";

import Link from "next/link";
import { useMe } from "@/query/me-hook";
import DDayBadge from "./DDayBadge";

interface Props {
  pageEmoji: string;
  pageTitle: string;
  pageSubtitle?: string;
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
      {/* 슬림 브랜드 바 — 의미상 4개 덩어리:
            ① 로고 / ② [사용자 + 경영일지] / ③ D-day / ④ 대시보드 버튼
          justify-between으로 4 그룹이 row를 균등 분할.
          그룹 간 간격은 자동(remaining space), 그룹 내부(②)만 gap-1.5로 타이트 묶음. */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 sm:px-3">
        {/* ① 로고 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/salespt-logo.png"
          alt="세일즈PT"
          className="h-6 w-auto shrink-0 object-contain sm:h-7"
        />

        {/* ② 사용자 + 경영일지 — 한 그룹으로 묶음 (gap-1.5 타이트) */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[11px] font-black text-gray-900 sm:text-sm">
            {display}
          </span>
          <span className="hidden shrink-0 text-xs font-black text-gray-900 sm:inline sm:text-sm">
            경영일지
          </span>
        </div>

        {/* ③ D-day 카운터 */}
        <div className="flex shrink-0">
          <DDayBadge graduationISO={me.data?.graduationISO} />
        </div>

        {/* ④ 대시보드 버튼 — 흰 배경 + 빨간 글자 (브랜드 #d71617) */}
        <Link
          href="/dashboard"
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-red bg-white px-2.5 py-1 text-[11px] font-bold text-brand-red shadow-sm transition-all hover:bg-red-50 hover:shadow-md active:scale-95 sm:px-3 sm:py-1.5 sm:text-xs"
          aria-label="대시보드로 이동"
        >
          <span>대시보드</span>
          <svg
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </header>

      {/* 페이지 배너 */}
      <div className="sticky top-12 z-40 flex h-12 items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 sm:gap-3 sm:px-4">
        <div className="h-5 w-1 shrink-0 rounded-sm bg-slate-500" />
        <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700 sm:gap-2">
          <span className="shrink-0 text-base leading-none">{pageEmoji}</span>
          <span className="truncate">{pageTitle}</span>
        </h1>
        {pageSubtitle && (
          <span className="ml-auto shrink-0 truncate text-[10px] text-slate-500 sm:text-xs">
            {pageSubtitle}
          </span>
        )}
      </div>
    </>
  );
}
