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

type Tab = {
  href: Route;
  label: string;
  match: (pathname: string) => boolean;
  Icon: (props: { active: boolean }) => React.ReactElement;
};

const TABS: Tab[] = [
  {
    href: "/contact" as Route,
    label: "컨택관리",
    match: (p) => p.startsWith("/contact"),
    Icon: ContactIcon,
  },
  {
    href: "/schedule" as Route,
    label: "일정·계약",
    match: (p) => p.startsWith("/schedule"),
    Icon: ScheduleIcon,
  },
  {
    href: "/calendar" as Route,
    label: "캘린더",
    match: (p) => p.startsWith("/calendar"),
    Icon: CalendarIcon,
  },
  {
    href: "/payment" as Route,
    label: "수납",
    match: (p) => p.startsWith("/payment"),
    Icon: PaymentIcon,
  },
  {
    href: "/db" as Route,
    label: "DB관리",
    match: (p) => p.startsWith("/db"),
    Icon: DbIcon,
  },
];

export default function TabBar() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-100 bg-white">
      {TABS.map(({ href, label, match, Icon }) => {
        const active = match(pathname);
        const colorCls = active
          ? "text-blue-600"
          : "text-gray-400 hover:text-gray-600";
        const labelCls = active ? "text-xs font-semibold" : "text-xs";
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${colorCls}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon active={active} />
            <span className={labelCls}>{label}</span>
          </Link>
        );
      })}
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
