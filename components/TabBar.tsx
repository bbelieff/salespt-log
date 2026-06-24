/**
 * TabBar — 5탭 하단 네비게이션 (4+1, ADR-0019 / 단계·컬러 ADR-0027).
 *
 * 정본: docs/design/prototypes/calendar-monthly.html `<nav class="bottom-nav">`
 * 규칙: docs/design/components.md §5 — 순서·라벨·아이콘 고정(ADR-0019).
 *   인디케이터 = 아이콘 위 STEP 배지, 선택 시 탭별 고유색(ADR-0027).
 *
 * 활성 탭은 usePathname() 으로 자동 감지. 라우팅은 useGuardedRouter(미저장 가드) 경유.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useGuardedRouter } from "@/components/DirtyGuard";

/** 탭별 고유색(ADR-0027) — 표준 Tailwind 팔레트. fill=칩/배지 채움, text=라벨. */
type TabColor = "blue" | "emerald" | "violet" | "rose";
const COLOR: Record<TabColor, { fill: string; text: string }> = {
  blue: { fill: "bg-blue-700", text: "text-blue-700" }, // DB생산 #1d4ed8
  emerald: { fill: "bg-emerald-600", text: "text-emerald-600" }, // 컨택관리 #059669
  violet: { fill: "bg-violet-600", text: "text-violet-600" }, // 일정·계약 #7c3aed
  rose: { fill: "bg-rose-600", text: "text-rose-600" }, // 실무/수납 #e11d48
};

type Tab = {
  href: Route;
  label: string;
  step: number; // STEP 배지 숫자 = 활성화 퍼널 단계 (ADR-0019)
  color: TabColor;
  match: (pathname: string) => boolean;
  Icon: (props: { active: boolean }) => React.ReactElement;
};

// 좌 2단계 · [중앙 캘린더 FAB] · 우 2단계 (4+1, ADR-0019). 순서가 활성화 퍼널 의미를 전달.
const LEFT: Tab[] = [
  { href: "/db" as Route, label: "DB생산", step: 1, color: "blue", match: (p) => p.startsWith("/db"), Icon: DbIcon },
  { href: "/contact" as Route, label: "컨택관리", step: 2, color: "emerald", match: (p) => p.startsWith("/contact"), Icon: ContactIcon },
];
const RIGHT: Tab[] = [
  { href: "/schedule" as Route, label: "일정·계약", step: 3, color: "violet", match: (p) => p.startsWith("/schedule"), Icon: ScheduleIcon },
  { href: "/payment" as Route, label: "실무/수납", step: 4, color: "rose", match: (p) => p.startsWith("/payment"), Icon: PaymentIcon },
];

/** 단계 사이 흐름 화살표(STEP1›2, STEP3›4). 캘린더 양옆엔 없음. 장식 → aria-hidden. */
function FlowArrow() {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 select-none items-center self-stretch px-0.5 text-base text-slate-300"
    >
      ›
    </span>
  );
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const { push } = useGuardedRouter();
  const c = COLOR[tab.color];
  return (
    <Link
      href={tab.href}
      // 미저장 가드: 직접 라우팅 막고 가드 라우터로(dirty 면 모달). Link 는 hover prefetch 유지용.
      onClick={(e) => {
        e.preventDefault();
        push(tab.href);
      }}
      // touch-manipulation: 모바일 300ms 탭 지연 제거. minHeight 44: 탭타깃 ≥44px.
      className="flex flex-1 flex-col items-center gap-1 py-1.5 transition-colors touch-manipulation active:bg-gray-100"
      style={{ minHeight: 44 }}
      aria-current={active ? "page" : undefined}
    >
      {/* STEP 배지 — 선택 시 탭색 채움(흰 글자), 비활성은 진한 회색. */}
      <span
        className={`rounded-full px-1.5 text-[9px] font-bold leading-tight ${
          active ? `${c.fill} text-white` : "bg-slate-100 text-slate-500"
        }`}
      >
        STEP {tab.step}
      </span>
      {/* 아이콘 칩 — 선택 시 탭색 채움+흰 글리프+그림자, 비활성은 slate-200 칩. */}
      <span
        aria-hidden="true"
        className={`flex h-8 w-9 items-center justify-center rounded-lg transition-colors ${
          active ? `${c.fill} text-white shadow` : "bg-slate-200 text-slate-600"
        }`}
      >
        <tab.Icon active={active} />
      </span>
      <span className={`text-xs ${active ? `font-bold ${c.text}` : "text-slate-600"}`}>
        {tab.label}
      </span>
    </Link>
  );
}

/** 중앙 캘린더 — 입체 FAB. 비활성=흰 원+slate 글리프, 활성=amber 채움+흰 글리프. 단계 없음(도구). */
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
        aria-hidden="true"
        className={`-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full border shadow-lg transition-colors ${
          active ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300 bg-white text-slate-500"
        }`}
      >
        <CalendarIcon active={active} />
      </span>
      <span className={`mt-1 text-xs ${active ? "font-bold text-amber-500" : "text-slate-600"}`}>
        캘린더
      </span>
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
      {/* px-5(20px): 아이폰 라운드 모서리에서 양끝 칩이 안쪽에 오도록. 넓은 화면=480px 캡 중앙정렬. */}
      <div className="mx-auto flex w-full max-w-bottom-nav items-end px-5">
        <TabItem tab={LEFT[0]!} active={LEFT[0]!.match(pathname)} />
        <FlowArrow />
        <TabItem tab={LEFT[1]!} active={LEFT[1]!.match(pathname)} />
        <CenterFab active={pathname.startsWith("/calendar")} />
        <TabItem tab={RIGHT[0]!} active={RIGHT[0]!.match(pathname)} />
        <FlowArrow />
        <TabItem tab={RIGHT[1]!} active={RIGHT[1]!.match(pathname)} />
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
