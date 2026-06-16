/**
 * TopHeader — 모든 (app) 탭 상단 공통 헤더.
 *
 * 구성 (1줄, h-12):
 *   [로고 png] [경영일지] [D-day] [{기수} {이름} 대표님]
 *
 * 로고는 /public/salespt-logo.png — 워드마크가 이미 포함되어 있어서
 * "세일즈PT" 텍스트는 별도 표시하지 않고 "경영일지"만 표기.
 *
 * 반응형 (2026-05-16 갱신 — 모바일에서 이름 truncate 방지 우선):
 *   - xs~xl (360~480, 모든 폰): "경영일지" **숨김** → 사용자명이 화면 폭 최대로 표시
 *     (로고 워드마크에 "세일즈PT" 가 이미 포함되어 의미 중복 해소)
 *   - 2xl+ (768+, 태블릿/데스크탑): "경영일지" 표시 (폭 여유)
 *   tailwind.config.ts 의 커스텀 screens: sm=390 / xl=480 / 2xl=768 — 폰은 sm~xl 범위.
 *
 * 사용처: contact / schedule / calendar / payment / db 5개 페이지.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { guideUrl } from "@/config";
import { useMe } from "@/query/me-hook";
import { useAnnouncements } from "@/query/announcements-hook";
import DDayBadge from "./DDayBadge";
import PageContainer from "./PageContainer";
import { identifyUser, resetUser, markInternal, clearInternal } from "@/analytics";
import {
  ANNOUNCEMENTS_SEEN_EVENT,
  hasUnseenUpdates,
} from "./announcements/AnnouncementsGate";

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

  // PostHog 식별 + 내부 트래픽 태깅 (ADR-0009/0013).
  //  - 관리자 본인 또는 대리접속(impersonating) = 내부 → is_internal super property.
  //  - 대리접속 중에는 대상 학생 PII 로 identify 하지 않음(ADR-0009). 비-대리 관리자는
  //    기존대로 role=admin 으로 identify 유지(+ 내부 태그).
  //  - 일반 수강생은 내부 태그 제거 후 identify.
  // 운영 환경 + init 된 경우에만 실제 전송(각 함수 내부 no-op 가드).
  useEffect(() => {
    const d = me.data;
    if (!d) return;
    const isInternal = d.sessionRole === "admin" || !!d.impersonating;
    if (isInternal) {
      markInternal(d.sessionRole ?? "admin");
    } else {
      clearInternal();
    }
    // 대리접속 중 식별 skip (대상 PII 오염 방지).
    if (d.impersonating || !d.email) return;
    identifyUser(d.sessionEmail ?? d.email, {
      cohort: d.cohort,
      name: d.name,
      role: d.sessionRole,
    });
  }, [
    me.data?.email,
    me.data?.sessionEmail,
    me.data?.impersonating,
    me.data?.cohort,
    me.data?.name,
    me.data?.sessionRole,
  ]);
  const display = formatDisplay(me.data?.cohort ?? "", me.data?.name ?? "");
  const [popupOpen, setPopupOpen] = useState(false);

  // 새소식 점 뱃지 — 안 본 새 업데이트가 있을 때만 (announcement-popup §3).
  // localStorage 는 클라 전용 → mount/[확인] 이벤트 시점에만 재계산 (SSR 안전).
  const ann = useAnnouncements();
  const [hasNews, setHasNews] = useState(false);
  useEffect(() => {
    const recompute = () => setHasNews(hasUnseenUpdates(ann.data?.latestPr ?? 0));
    recompute();
    window.addEventListener(ANNOUNCEMENTS_SEEN_EVENT, recompute);
    return () => window.removeEventListener(ANNOUNCEMENTS_SEEN_EVENT, recompute);
  }, [ann.data?.latestPr]);

  return (
    <>
      {/* 슬림 브랜드 바 — 의미상 4개 덩어리:
            ① 로고 / ② [사용자 + 경영일지] / ③ D-day / ④ 대시보드 버튼
          justify-between으로 4 그룹이 row를 균등 분할.
          그룹 간 간격은 자동(remaining space), 그룹 내부(②)만 gap-1.5로 타이트 묶음. */}
      <header className="sticky top-0 z-50 h-12 border-b border-gray-100 bg-white">
       {/* full-bleed 배경 + 내용만 대시보드와 동일 6xl 중앙정렬 */}
       <PageContainer
         width="wide"
         className="flex h-full items-center justify-between gap-2 px-2 sm:px-3"
       >
        {/* ① 로고 — 클릭 시 로그아웃 팝업 토글.
              sessionRole 이 admin/trainer 면 로고 옆에 작은 "← 메뉴" 백버튼 추가
              (impersonation 중에도 마스터 메뉴로 빠르게 복귀 가능). */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPopupOpen((v) => !v)}
            className="relative rounded transition-transform active:scale-95"
            aria-label="계정 메뉴 열기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/salespt-logo.png"
              alt="세일즈PT"
              className="h-6 w-auto object-contain sm:h-7"
            />
            {/* 새소식 점 뱃지 — 안 본 새 업데이트 있을 때 */}
            {hasNews && (
              <span
                className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand-red"
                aria-label="새소식 있음"
              />
            )}
          </button>
          {me.data?.sessionRole === "admin" && (
            <Link
              href="/admin/users"
              aria-label="수강생 관리로 돌아가기"
              className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-100 sm:text-xs"
            >
              ← 메뉴
            </Link>
          )}
          {me.data?.sessionRole === "trainer" && (
            <Link
              href="/trainer"
              aria-label="트레이너 페이지로 돌아가기"
              className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-100 sm:text-xs"
            >
              ← 메뉴
            </Link>
          )}
          {/* 아레나 회장 — 플레이어 겸직(role=trainee)이라 sessionRole 무관, captainOf 로 판별. */}
          {me.data?.captainOf && (
            <Link
              href="/captain"
              aria-label="기수임원 페이지"
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100 sm:text-xs"
            >
              ★ 기수임원
            </Link>
          )}
        </div>

        {/* ② 사용자 + 경영일지 — 한 그룹으로 묶음 (gap-1.5 타이트).
              spreadsheetId 가 있으면 사용자 이름 → 본인 구글 시트 새 탭으로 직접 열기
              (수강생/impersonation 대상의 시트 빠른 접근). admin 본인 미등록 시 plain span. */}
        <div className="flex min-w-0 items-center gap-1.5">
          {me.data?.spreadsheetId ? (
            <a
              href={`https://docs.google.com/spreadsheets/d/${me.data.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              title="내 구글 시트 새 탭으로 열기"
              className="min-w-0 truncate text-[11px] font-black text-gray-900 hover:underline sm:text-sm"
            >
              {display}
            </a>
          ) : (
            <span className="min-w-0 truncate text-[11px] font-black text-gray-900 sm:text-sm">
              {display}
            </span>
          )}
          {/* "경영일지" — 폰은 전 사이즈 숨김 (이름 truncate 방지), 2xl(768px+) 부터 표시.
                tailwind.config.ts 의 sm(390)·xl(480) 은 모두 폰 → 2xl 만 태블릿+. */}
          <span className="hidden shrink-0 text-xs font-black text-gray-900 2xl:inline 2xl:text-sm">
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
       </PageContainer>
      </header>

      {/* 로고 클릭 팝업 — 로그아웃 + 내 시트 열기 */}
      {popupOpen && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setPopupOpen(false)}
          />
          <div className="fixed left-3 top-14 z-[56] w-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-brand-red">
                  {me.data?.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900">{display}</div>
                  <div className="truncate text-[11px] text-gray-500">
                    {me.data?.email ?? ""}
                  </div>
                </div>
              </div>
            </div>
            {/* 새소식 — 보관함(/updates)으로 (announcement-popup §7-4) */}
            <Link
              href="/updates"
              onClick={() => setPopupOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span className="flex items-center gap-1.5">
                새소식
                {hasNews && <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />}
              </span>
            </Link>
            {/* 사용 가이드(노션) — env 설정 시 모든 (app) 페이지에서 상시 진입점. 새 탭. */}
            {guideUrl() && (
              <a
                href={guideUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPopupOpen(false)}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <span>📚 사용 가이드</span>
              </a>
            )}
            {me.data?.sessionRole === "admin" && (
              <Link
                href="/admin"
                onClick={() => setPopupOpen(false)}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span>관리자 페이지 →</span>
              </Link>
            )}
            {me.data?.sessionRole === "trainer" && (
              <Link
                href="/trainer"
                onClick={() => setPopupOpen(false)}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span>트레이너 페이지 →</span>
              </Link>
            )}
            {me.data?.archivedSpreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${me.data.archivedSpreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPopupOpen(false)}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>
                  이전 {me.data.archivedCohort ? `${me.data.archivedCohort}기` : "기수"} 일지
                  보기 (읽기전용) →
                </span>
              </a>
            )}
            {me.data?.captainOf && (
              <Link
                href="/captain"
                onClick={() => setPopupOpen(false)}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
                <span>기수임원 페이지 →</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setPopupOpen(false);
                resetUser(); // 식별 해제 (다음 로그인과 세션 분리)
                signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              <span>로그아웃</span>
            </button>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[10px] text-gray-400">
              © SalesPT · v1.0
            </div>
          </div>
        </>
      )}

      {/* Admin/Trainer 상태바 제거 — TopHeader 가 이미 impersonation 대상의
            cohort·이름·D-day 표시. 중복 정보. 진입점은 로고 popup 메뉴로. */}

      {/* 페이지 배너 — 배경 full-bleed + 내용 6xl 중앙정렬 */}
      <div className="sticky top-12 z-40 h-12 border-b border-slate-200 bg-slate-100">
        <PageContainer
          width="wide"
          className="flex h-full items-center gap-2 px-3 sm:gap-3 sm:px-4"
        >
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
        </PageContainer>
      </div>
    </>
  );
}
