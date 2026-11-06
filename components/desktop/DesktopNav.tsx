/**
 * DesktopNav — 좌측 사이드탭. pc(1024px+)는 본문을 밀고 붙어 있고(접기·펼치기),
 * 1024px 미만은 하단 탭 대신 본문을 덮는 서랍(2026-11-07 belie) — 닫혀 있으면 화면 밖에 숨고,
 * 페이지 배너 왼쪽 메뉴 버튼(TopHeader)으로 연다. 분기는 CSS(`pc:`)로만 가른다 — JS 로 폭을 재서
 * 렌더를 가르지 않는다(hydration 깨짐 방지, SPEC §1). 열림 상태는 mobile-nav.ts.
 * 영업 4단계 정의는 TabBar.NAV_STEPS 단일 원천(두 벌 금지).
 * 앱 내부 이동은 useGuardedRouter 경유 — 미저장 이탈 가드를 받는다.
 * 이 컴포넌트는 (app) layout 의 DirtyProvider 안에서 렌더된다.
 * 글래스 도장은 루트 `desktop-nav` 클래스에 걸고, 실체는 전부
 * globals.css 의 `.desktop-shell` 스코프 안에만 둔다(모바일 무변경).
 */
"use client";

import Link from "next/link";
import { isAdminSession } from "@/components/auth/nav-entitlements";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Table2, BookOpen, CalendarDays, FolderOpen, LayoutDashboard, MessagesSquare, Newspaper, NotebookPen, PanelLeftClose, PanelLeftOpen, Shield, Target, X } from "lucide-react";
import { NAV_STEPS } from "@/components/TabBar";
import { useGuardedRouter } from "@/components/DirtyGuard";
import { SALESPT_CAFE_URL, WORK_MANUAL_URL } from "@/config/links";
import { useMe } from "@/query/me-hook";
import StepBadge, { type StepId } from "@/components/ui/StepBadge";
import { MOBILE_NAV_ID, claimEdgeTouch, getMobileNavOpen, setMobileNavOpen, swipeBlocked, swipeIntent, useMobileNavOpen } from "./mobile-nav";

/** 단계 번호 배지 — 단계색 연한 배경 + 진한 글자 (표준 팔레트). */
const STEP_BADGE: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  violet: "bg-violet-100 text-violet-800",
  rose: "bg-rose-100 text-rose-800",
};
const STEP_ACTIVE: Record<string, string> = {
  blue: "bg-blue-50 font-bold text-blue-700",
  emerald: "bg-emerald-50 font-bold text-emerald-700",
  violet: "bg-violet-50 font-bold text-violet-700",
  rose: "bg-rose-50 font-bold text-rose-700",
};
const NAV_COLLAPSED_KEY = "salespt:desktop-nav:collapsed";

/** ↗ — 장식이 아니라 약속. 새 탭으로 열리는 링크에만 붙인다. */
function ExternalArrow() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
      />
    </svg>
  );
}

/** 메뉴 행 색 — 활성/비활성. SPEC §3.3 고정. */
function rowClass(active: boolean, activeClass?: string): string {
  return active
    ? activeClass ?? "bg-red-50 font-bold text-red-800"
    : "font-medium text-slate-700 hover:bg-slate-50";
}

/**
 * 앱 내부 이동 행 — 미저장 가드 라우터 경유(hover prefetch 유지용 Link).
 * sub=true 면 업무도구 박스 안의 작은 행. 축소 시에도 전체 라벨을 제공한다.
 */
function SideLink({
  href,
  active,
  label,
  sub = false,
  compact = false,
  activeClass,
  children,
}: {
  href: Route;
  active: boolean;
  label: string;
  sub?: boolean;
  compact?: boolean;
  activeClass?: string;
  children: ReactNode;
}) {
  const { push } = useGuardedRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        push(href);
      }}
      aria-label={label}
      title={compact ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={
        sub
          ? `flex min-h-9 items-center gap-2 rounded-lg py-1 text-sm transition-colors ${compact ? "justify-center px-0" : "px-2"} ${rowClass(active, activeClass)}`
          : `flex min-h-11 items-center gap-2 rounded-lg transition-colors ${compact ? "justify-center px-0" : "px-3"} ${rowClass(active, activeClass)}`
      }
    >
      {children}
    </Link>
  );
}

/** 업무도구는 영업 단계와 독립된 묶음. 새 탭으로 열리는 것에만 ↗. */
function WorkTools({ pathname, compact }: { pathname: string; compact: boolean }) {
  const me = useMe();
  const feedbackFolderId = me.data?.feedbackFolderId ?? "";
  // driveLinkStatus 는 레거시 행에서 비어 있을 수 있다 — 폴더가 있으면 연결된
  // 것으로 보고 기존 동작을 유지한다(멀쩡한 링크를 끊지 않는다).
  // 명시적 "error" 또는 폴더 없음일 때만 /payment#drive-link 로 보내 기존
  // DriveLinkBar 연결 UI 로 이어준다(가드 라우터 경유, 같은 DirtyProvider 안).
  const driveInvalid = (me.data?.driveLinkStatus ?? "") === "error";
  const driveUrl =
    feedbackFolderId && !driveInvalid
      ? `https://drive.google.com/drive/folders/${encodeURIComponent(feedbackFolderId)}`
      : "";
  const newsActive = pathname.startsWith("/payment/news");
  const logActive = pathname.startsWith("/training-log");
  return (
    <section aria-label="업무도구" className={`mt-4 rounded-xl border border-slate-200/80 bg-slate-200/65 shadow-inner shadow-white/70 ${compact ? "p-1" : "p-2"}`}>
      {!compact && <p className="px-2 pb-1 text-xs font-bold text-slate-600">업무도구</p>}
      {driveUrl ? (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="구글드라이브 (새 탭에서 열림)"
          title={compact ? "구글드라이브 (새 탭)" : undefined}
          className={`flex min-h-9 items-center gap-2 rounded-lg py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-white/75 ${compact ? "justify-center px-0" : "px-2"}`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!compact && <>구글드라이브 <ExternalArrow /></>}
        </a>
      ) : (
        <SideLink sub compact={compact} href={"/payment#drive-link" as Route} active={false} label="구글드라이브 — 연결 필요">
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!compact && <>구글드라이브 <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-800">연결 필요</span></>}
        </SideLink>
      )}
      <SideLink
        sub
        compact={compact}
        href={"/payment/news" as Route}
        active={newsActive}
        label="정책자금뉴스"
      >
        <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && "정책자금뉴스"}
      </SideLink>
      {/* 트레이닝일지 — 노션 기수 페이지 대신 앱 안에서 내 일지만(2026-10-30 belie). */}
      <SideLink sub compact={compact} href={"/training-log" as Route} active={logActive} label="트레이닝일지">
        <NotebookPen className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && "트레이닝일지"}
      </SideLink>
      <a
        href={WORK_MANUAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="업무매뉴얼 (새 탭에서 열림)"
        title={compact ? "업무매뉴얼 (새 탭)" : undefined}
        className={`flex min-h-9 items-center gap-2 rounded-lg py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-white/75 ${compact ? "justify-center px-0" : "px-2"}`}
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <>업무매뉴얼 <ExternalArrow /></>}
      </a>
      <a
        href={SALESPT_CAFE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="세일즈PT 카페 (새 탭에서 열림)"
        title={compact ? "세일즈PT 카페 (새 탭)" : undefined}
        className={`flex min-h-9 items-center gap-2 rounded-lg py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-white/75 ${compact ? "justify-center px-0" : "px-2"}`}
      >
        <MessagesSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <>세일즈PT 카페 <ExternalArrow /></>}
      </a>
    </section>
  );
}

export default function DesktopNav() {
  const pathname = usePathname() ?? "";
  const me = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const open = useMobileNavOpen();
  const closeRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // 손가락으로 오른쪽으로 밀면 열고, 열린 채 왼쪽으로 밀면 닫는다. PC(붙은 사이드탭 = sticky)는 무시 — 폭은 CSS 가 정한다.
  // touchmove 는 passive(스크롤을 막지 않음). 다른 팝업(aria-modal)이 떠 있으면 열지 않는다.
  // ★왼쪽 끝(EDGE_ZONE)에서 시작한 밀기는 브라우저 「뒤로 가기」 제스처가 가져가므로(2026-11-07 belie
  // 「밀면 뒤로가기가 더 많이 됨」) touchstart 에서 기본 동작을 막아 서랍이 받는다 — 버튼·링크·입력 칸 위 터치는 그대로.
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const nav = navRef.current;
      start = null;
      if (!nav || e.touches.length !== 1 || getComputedStyle(nav).position === "sticky" || swipeBlocked(e.target)) return;
      if (!getMobileNavOpen() && document.querySelector('[aria-modal="true"]')) return;
      start = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      if (!getMobileNavOpen() && claimEdgeTouch(start.x, e.target) && e.cancelable) e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const intent = swipeIntent(getMobileNavOpen(), e.touches[0]!.clientX - start.x, e.touches[0]!.clientY - start.y);
      if (intent) { setMobileNavOpen(intent === "open"); start = null; }
    };
    const onEnd = () => { start = null; };
    document.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  // 서랍: 다른 화면으로 가면 닫고, 열려 있는 동안 Esc 로 닫는다. 뒤 화면 스크롤 잠금은 CSS(globals.css, 1024px 미만만).
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", onKey);
    // 닫힌 서랍은 invisible 이라 같은 순간에는 초점을 못 받는다 — 보이게 된 다음 틱에 닫기 버튼으로.
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [open]);
  // 서랍은 늘 펼친 모양(아이콘만 보이는 접힘은 PC 전용).
  const compact = collapsed && !open;
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1"); } catch { /* 저장소 접근이 막혀도 펼친 메뉴는 사용 가능 */ }
  }, []);
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* 선택 저장은 부가 기능 */ }
  }
  // 관리자 항목 노출 — 서버가 준 값(useMe)으로만 판정. 클라이언트에서 이메일
  // 직접 판정 같은 임의 판단 금지. 둘 다 없으면 숨긴다(생략이 오판보다 낫다).
  const isAdmin = isAdminSession(me.data);
  return (
    <>
    {open && <div aria-hidden="true" className="app-nav-scrim fixed inset-0 z-[60] bg-slate-900/40 pc:hidden" onClick={() => setMobileNavOpen(false)} />}
    <nav
      ref={navRef}
      id={MOBILE_NAV_ID}
      aria-label="주 메뉴"
      data-collapsed={compact}
      data-open={open}
      className={`desktop-nav fixed inset-y-0 left-0 z-[61] flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl duration-200 ease-out motion-reduce:transition-none pc:sticky pc:top-0 pc:z-auto pc:max-w-none pc:translate-x-0 pc:shadow-none pc:visible ${open ? "translate-x-0 transition-transform" : "invisible -translate-x-full transition-[transform,visibility]"}`}
    >
      {/* 로고는 메인 TopHeader에만 표시한다. */}
      <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 ${compact ? "justify-center px-1" : "gap-2 px-4"}`}>
        {!compact && <span className="truncate text-sm font-black text-slate-900">경영일지</span>}
        <button type="button" onClick={toggleCollapsed} aria-label={compact ? "사이드탭 펼치기" : "사이드탭 축소하기"} title={compact ? "펼치기" : "축소하기"} className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 pc:flex ${compact ? "" : "ml-auto"}`}>
          {compact ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button ref={closeRef} type="button" onClick={() => setMobileNavOpen(false)} aria-label="메뉴 닫기" className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 pc:hidden">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* 메뉴 */}
      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? "p-2" : "p-3"}`}>
        <SideLink
          href={"/dashboard" as Route}
          active={pathname.startsWith("/dashboard")}
          label="대시보드"
          compact={compact}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!compact && "대시보드"}
        </SideLink>
        <SideLink href={"/calendar" as Route} active={pathname.startsWith("/calendar")} label="캘린더" compact={compact}>
          <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!compact && "캘린더"}
        </SideLink>
        {/* 주간목표 — 캘린더 바로 아래(belie 2026-10-09). 수강생 주간목표·PT과제 화면(/weekly-goals). */}
        <SideLink href={"/weekly-goals" as Route} active={pathname.startsWith("/weekly-goals")} label="주간목표" compact={compact}>
          <Target className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!compact && "주간목표"}
        </SideLink>
        {!compact && <p className="px-3 pb-1 pt-4 text-xs font-bold text-slate-400">영업 4단계</p>}
        {compact && <div className="mx-2 my-3 border-t border-slate-200" aria-hidden="true" />}
        {NAV_STEPS.map((tab) => (
          <div key={tab.href}>
            <SideLink href={tab.href} active={tab.match(pathname) && pathname !== "/db-sheet"} activeClass={STEP_ACTIVE[tab.color]} label={`STEP ${tab.step} ${tab.label}`} compact={compact}>
              <span
                aria-hidden="true"
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tab.match(pathname) ? "bg-white shadow-sm" : ""}`}
              >
                <tab.Icon active={tab.match(pathname) && pathname !== "/db-sheet"} />
                {compact && <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white text-px-10 font-bold ${STEP_BADGE[tab.color] ?? "bg-slate-100 text-slate-600"}`}>{tab.step}</span>}
              </span>
              {!compact && <><StepBadge aria-hidden step={String(tab.step) as StepId} /><span className="truncate">{tab.label}</span></>}
            </SideLink>
            {tab.href === "/db" && <SideLink href={"/db-sheet" as Route} active={pathname === "/db-sheet"} label="STEP 1.5 DB관리시트" compact={compact} activeClass="bg-blue-50 font-semibold text-blue-700">
              <span aria-hidden="true" className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><Table2 className="h-4 w-4"/>{compact&&<span className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-b from-blue-100 to-emerald-100 text-px-10 font-bold px-0.5">1.5</span>}</span>
              {!compact&&<><StepBadge aria-hidden step="1.5" /><span className="truncate">DB관리시트</span></>}
            </SideLink>}
          </div>
        ))}
        <WorkTools pathname={pathname} compact={compact} />
      </div>

      {/* 맨 아래 — 관리자 */}
      {isAdmin && (
        <div className={`mt-auto shrink-0 border-t border-slate-100 ${compact ? "p-2" : "p-3"}`}>
          <SideLink
            href={"/admin" as Route}
            active={pathname.startsWith("/admin")}
            label="관리자"
            compact={compact}
          >
            <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!compact && "관리자"}
          </SideLink>
        </div>
      )}
    </nav>
    </>
  );
}
