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
function rowClass(active: boolean): string {
  return active
    ? "bg-red-50 font-bold text-red-800"
    : "font-medium text-slate-700 hover:bg-slate-50";
}

/**
 * 앱 내부 이동 행 — 미저장 가드 라우터 경유(hover prefetch 유지용 Link).
 * sub=true 면 실무/수납 하위 소탭 스타일(pl-11 + 좌측 안내선, h-9 이상).
 */
function SideLink({
  href,
  active,
  label,
  sub = false,
  children,
}: {
  href: Route;
  active: boolean;
  label: string;
  sub?: boolean;
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
      aria-current={active ? "page" : undefined}
      className={
        sub
          ? `flex min-h-9 items-center gap-1.5 border-l-2 border-slate-100 py-1 pl-11 pr-3 text-sm transition-colors ${rowClass(active)}`
          : `flex min-h-11 items-center gap-2.5 rounded-lg px-3 transition-colors ${rowClass(active)}`
      }
    >
      {children}
    </Link>
  );
}

/** 실무/수납 하위 소탭 3개 — 항상 펼친 상태. 새 탭으로 열리는 것에만 ↗. */
function PaymentSubTabs({ pathname }: { pathname: string }) {
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
    <div>
      {driveUrl ? (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-9 items-center gap-1.5 border-l-2 border-slate-100 py-1 pl-11 pr-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          구글드라이브
          <ExternalArrow />
        </a>
      ) : (
        <SideLink sub href={"/payment#drive-link" as Route} active={false} label="구글드라이브 — 연결 필요">
          구글드라이브
          <span className="rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-800">
            연결 필요
          </span>
        </SideLink>
      )}
      <SideLink
        sub
        href={"/payment/news" as Route}
        active={newsActive}
        label="정책자금뉴스"
      >
        정책자금뉴스
      </SideLink>
      <a
        href={WORK_MANUAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="업무매뉴얼 (새 탭에서 열림)"
        className="flex min-h-9 items-center gap-1.5 border-l-2 border-slate-100 py-1 pl-11 pr-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        업무매뉴얼
        <ExternalArrow />
      </a>
    </div>
  );
}

export default function DesktopNav() {
  const pathname = usePathname() ?? "";
  const me = useMe();
  // 관리자 항목 노출 — 서버가 준 값(useMe)으로만 판정. 클라이언트에서 이메일
  // 직접 판정 같은 임의 판단 금지. 둘 다 없으면 숨긴다(생략이 오판보다 낫다).
  const isAdmin = me.data?.isAdmin === true || me.data?.sessionRole === "admin";
  return (
    <nav
      aria-label="주 메뉴"
      className="desktop-nav sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white pc:flex"
    >
      {/* 로고 블록 */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-4">
        <img
          src="/salespt-logo.png"
          alt="세일즈PT"
          className="h-6 w-auto shrink-0 object-contain"
        />
        <span className="truncate text-sm font-black text-slate-900">
          경영일지
        </span>
      </div>

      {/* 메뉴 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SideLink
          href={"/dashboard" as Route}
          active={pathname.startsWith("/dashboard")}
          label="대시보드"
        >
          대시보드
        </SideLink>
        <p className="px-3 pb-1 pt-4 text-xs font-bold text-slate-400">
          영업 4단계
        </p>
        {NAV_STEPS.map((tab) => (
          <div key={tab.href}>
            <SideLink href={tab.href} active={tab.match(pathname)} label={tab.label}>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STEP_BADGE[tab.color] ?? "bg-slate-100 text-slate-600"}`}
              >
                {tab.step}
              </span>
              {tab.label}
            </SideLink>
            {tab.href === "/payment" && <PaymentSubTabs pathname={pathname} />}
          </div>
        ))}
        <SideLink
          href={"/calendar" as Route}
          active={pathname.startsWith("/calendar")}
          label="캘린더"
        >
          캘린더
        </SideLink>
      </div>

      {/* 맨 아래 — 관리자 */}
      {isAdmin && (
        <div className="mt-auto shrink-0 border-t border-slate-100 p-3">
          <SideLink
            href={"/admin" as Route}
            active={pathname.startsWith("/admin")}
            label="관리자"
          >
            관리자
          </SideLink>
        </div>
      )}
    </nav>
  );
}
