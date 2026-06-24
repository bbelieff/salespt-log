/**
 * TabBar — 5탭 하단 네비게이션.
 *
 * 정본: docs/design/prototypes/calendar-monthly.html `<nav class="bottom-nav">`
 * 규칙: docs/design/components.md §5 — 5탭 순서·라벨·아이콘 고정 (변경 시 ADR 필요)
 *
 * 활성 탭은 usePathname() 으로 자동 감지.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useGuardedRouter } from "@/components/DirtyGuard";

type Tab = {
  href: Route;
  label: string;
  step: number; // 활성화 퍼널 단계 (라벨 아래 점 갯수) — ADR-0019
  match: (pathname: string) => boolean;
  Icon: (props: { active: boolean }) => React.ReactElement;
};

// 좌 2단계 · [중앙 캘린더 FAB] · 우 2단계 (4+1, ADR-0019). 순서가 활성화 퍼널 의미를 전달.
const LEFT: Tab[] = [
  { href: "/db" as Route, label: "DB생산", step: 1, match: (p) => p.startsWith("/db"), Icon: DbIcon },
  { href: "/contact" as Route, label: "컨택관리", step: 2, match: (p) => p.startsWith("/contact"), Icon: ContactIcon },
];
const RIGHT: Tab[] = [
  { href: "/schedule" as Route, label: "일정·계약", step: 3, match: (p) => p.startsWith("/schedule"), Icon: ScheduleIcon },
  { href: "/payment" as Route, label: "실무/수납", step: 4, match: (p) => p.startsWith("/payment"), Icon: PaymentIcon },
];

/** 단계 점(갯수=단계). 현재 탭만 파랑, 나머지 회색. 서수/뱃지 아님. */
function Dots({ n, active }: { n: number; active: boolean }) {
  return (
    <div className="flex h-1.5 items-center gap-0.5">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`block h-1 w-1 rounded-full ${active ? "bg-blue-600" : "bg-slate-300"}`}
        />
      ))}
    </div>
  );
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const color = active ? "text-blue-600" : "text-gray-400 hover:text-gray-600";
  const { push } = useGuardedRouter();
  return (
    <Link
      href={tab.href}
      // 미저장 가드: 직접 라우팅 막고 가드 라우터로(dirty 면 모달). Link 는 hover prefetch 유지용.
      onClick={(e) => {
        e.preventDefault();
        push(tab.href);
      }}
      // touch-manipulation: 모바일 300ms 탭 지연 제거. active:bg: 네비 완료 전 눌림 즉시 표시.
      className={`flex flex-1 flex-col items-center gap-1 py-2 transition-colors touch-manipulation active:bg-gray-100 ${color}`}
      aria-current={active ? "page" : undefined}
    >
      <tab.Icon active={active} />
      <span className={`text-xs ${active ? "font-semibold" : ""}`}>{tab.label}</span>
      <Dots n={tab.step} active={active} />
    </Link>
  );
}

/** 중앙 캘린더 — 중립 입체 FAB(흰 원+테두리+그림자, 위로 띄움). 대시보드(홈)보다 약한 강조. */
function CenterFab({ active }: { active: boolean }) {
  const { push } = useGuardedRouter();
  return (
    <Link
      href={"/calendar" as Route}
      onClick={(e) => {
        e.preventDefault();
        push("/calendar");
      }}
      aria-label="캘린더"
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-end touch-manipulation"
    >
      <span
        className={`-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full border bg-white shadow-lg transition-colors ${
          active ? "border-blue-200 text-blue-600" : "border-gray-300 text-gray-500"
        }`}
      >
        <CalendarIcon active={false} />
      </span>
      <span className={`mt-1 text-xs ${active ? "font-semibold text-blue-600" : "text-gray-400"}`}>
        캘린더
      </span>
      <div className="h-1.5" />
    </Link>
  );
}

export default function TabBar() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white"
      style={{
        // iOS 라운드 디스플레이 모서리 + 홈 인디케이터 영역 안전 패딩.
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* 모바일=전폭, 넓은 화면=480px 캡 중앙정렬. 캡 안 탭은 flex-1 균등. */}
      <div className="mx-auto flex w-full max-w-bottom-nav items-end px-1">
        {LEFT.map((t) => (
          <TabItem key={t.href} tab={t} active={t.match(pathname)} />
        ))}
        <CenterFab active={pathname.startsWith("/calendar")} />
        {RIGHT.map((t) => (
          <TabItem key={t.href} tab={t} active={t.match(pathname)} />
        ))}
      </div>
    </nav>
  );
}

// ── 아이콘 SVG (calendar-monthly.html 정본을 그대로 옮김) ──────────

function ContactIcon(_props: { active: boolean }) {
  // 수화기 + 우상단 캘린더 + 점 4개 (call → schedule → 4 channels)
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        transform="translate(-1, 5.5) scale(0.68)"
      />
      <rect
        x="14.5"
        y="0.5"
        width="9"
        height="9"
        rx="1.4"
        fill="white"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <line x1="14.5" y1="3.3" x2="23.5" y2="3.3" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16.8" y1="0.5" x2="16.8" y2="2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <line x1="21.2" y1="0.5" x2="21.2" y2="2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="5.7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5.7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="21" cy="5.7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7.8" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScheduleIcon(_props: { active: boolean }) {
  // 클립보드 + 체크
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  // 활성 시 filled, 비활성 시 outline
  if (active) {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function PaymentIcon(_props: { active: boolean }) {
  // 코인 + $
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DbIcon(_props: { active: boolean }) {
  // 카트 + 위에 DB박스 (DB 매입 + 생산)
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
      <path d="M3 4 L5 4 L7 13 L18 13 L20 6 L7 6" />
      <rect x="9" y="7.5" width="7" height="4.5" rx="0.5" fill="white" />
      <line x1="9" y1="10" x2="16" y2="10" />
      <line x1="11" y1="7.5" x2="11" y2="12" />
    </svg>
  );
}
