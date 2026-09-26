/**
 * DesktopNav — pc(1024px+) 전용 좌측 사이드바.
 *
 * 폰에서는 `hidden`이라 DOM만 있고 보이지 않는다. 분기는 CSS(`pc:flex`)로만
 * 가른다 — JS 로 폭을 재서 렌더를 가르지 않는다(서버/클라이언트 불일치에 따른
 * hydration 깨짐 방지, SPEC §1).
 * 영업 4단계 정의는 TabBar.NAV_STEPS 단일 원천(두 벌 금지).
 * 앱 내부 이동은 useGuardedRouter 경유 — 미저장 이탈 가드를 받는다.
 * 이 컴포넌트는 (app) layout 의 DirtyProvider 안에서 렌더된다.
 * 글래스 도장은 루트 `desktop-nav` 클래스에 걸고, 실체는 전부
 * globals.css 의 `.desktop-shell` 스코프 안에만 둔다(모바일 무변경).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, FolderOpen, LayoutDashboard, Newspaper, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import { NAV_STEPS } from "@/components/TabBar";
import { useGuardedRouter } from "@/components/DirtyGuard";
import { WORK_MANUAL_URL } from "@/config/links";
import { useMe } from "@/query/me-hook";

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
    </section>
  );
}

export default function DesktopNav() {
  const pathname = usePathname() ?? "";
  const me = useMe();
  const [collapsed, setCollapsed] = useState(false);
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
  const isAdmin = me.data?.isAdmin === true || me.data?.sessionRole === "admin";
  return (
    <nav
      aria-label="주 메뉴"
      data-collapsed={collapsed}
      className="desktop-nav sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white pc:flex"
    >
      {/* 로고 블록 */}
      <div className={`flex shrink-0 items-center border-b border-slate-100 ${collapsed ? "h-20 flex-col justify-center gap-1 px-1" : "h-16 gap-2 px-4"}`}>
        <img
          src="/salespt-logo.png"
          alt="세일즈PT"
          className={`h-6 shrink-0 object-contain ${collapsed ? "w-8" : "w-auto"}`}
        />
        {!collapsed && <span className="truncate text-sm font-black text-slate-900">경영일지</span>}
        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "사이드탭 펼치기" : "사이드탭 축소하기"} title={collapsed ? "펼치기" : "축소하기"} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 ${collapsed ? "" : "ml-auto"}`}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {/* 메뉴 */}
      <div className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? "p-2" : "p-3"}`}>
        <SideLink
          href={"/dashboard" as Route}
          active={pathname.startsWith("/dashboard")}
          label="대시보드"
          compact={collapsed}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && "대시보드"}
        </SideLink>
        <SideLink href={"/calendar" as Route} active={pathname.startsWith("/calendar")} label="캘린더" compact={collapsed}>
          <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && "캘린더"}
        </SideLink>
        {!collapsed && <p className="px-3 pb-1 pt-4 text-xs font-bold text-slate-400">영업 4단계</p>}
        {collapsed && <div className="mx-2 my-3 border-t border-slate-200" aria-hidden="true" />}
        {NAV_STEPS.map((tab) => (
          <div key={tab.href}>
            <SideLink href={tab.href} active={tab.match(pathname)} activeClass={STEP_ACTIVE[tab.color]} label={`STEP ${tab.step} ${tab.label}`} compact={collapsed}>
              <span
                aria-hidden="true"
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tab.match(pathname) ? "bg-white shadow-sm" : ""}`}
              >
                <tab.Icon active={tab.match(pathname)} />
                {collapsed && <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[10px] font-bold ${STEP_BADGE[tab.color] ?? "bg-slate-100 text-slate-600"}`}>{tab.step}</span>}
              </span>
              {!collapsed && <><span aria-hidden="true" className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${STEP_BADGE[tab.color] ?? "bg-slate-100 text-slate-600"}`}>STEP {tab.step}</span><span className="truncate">{tab.label}</span></>}
            </SideLink>
          </div>
        ))}
        <WorkTools pathname={pathname} compact={collapsed} />
      </div>

      {/* 맨 아래 — 관리자 */}
      {isAdmin && (
        <div className={`mt-auto shrink-0 border-t border-slate-100 ${collapsed ? "p-2" : "p-3"}`}>
          <SideLink
            href={"/admin" as Route}
            active={pathname.startsWith("/admin")}
            label="관리자"
            compact={collapsed}
          >
            <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!collapsed && "관리자"}
          </SideLink>
        </div>
      )}
    </nav>
  );
}
