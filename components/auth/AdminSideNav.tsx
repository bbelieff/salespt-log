/**
 * AdminSideNav — 관리자모드 PC(1024px+) 왼쪽 메뉴(admin-side-nav, 2026-11-03).
 *
 * 메뉴 사이를 홈을 거치지 않고 오가게 한다. 승인 대기 수는 메뉴 옆 숫자로 늘 보인다.
 * 1024px 미만은 렌더 안 함(모바일은 홈 카드 + 「← 마스터 메뉴」 그대로).
 * 캡쳐해서 공지하는 화면(아레나 전광판·공유왕)은 메뉴 없이 둔다 — 캡쳐에 찍히지 않게.
 * 권한 가드는 각 페이지가 맡는다. 여기선 마스터 전용 항목(팝업관리·트레이너 페이지)만 숨긴다.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

/** 메뉴 없이 보여 줄 화면 — 캡쳐용. */
const BARE_PREFIXES = ["/admin/arena/scoreboard", "/admin/arena/share-scores"];

type Item = { href: string; label: string; icon: string; badge?: number; masterOnly?: boolean };

export default function AdminSideNav({
  sessionEmail,
  isMaster,
  pendingTrainees,
  pendingTrainers,
}: {
  sessionEmail: string;
  isMaster: boolean;
  pendingTrainees: number;
  pendingTrainers: number;
}) {
  const pathname = usePathname() ?? "";
  if (BARE_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const items: Item[] = [
    { href: "/admin", label: "홈", icon: "🏠" },
    { href: "/admin/users", label: "수강생 관리", icon: "🗂️", badge: pendingTrainees },
    { href: "/admin/trainers", label: "트레이너 관리", icon: "👥", badge: pendingTrainers },
    { href: "/admin/cohorts", label: "기수 관리", icon: "📅" },
    { href: "/admin/arena", label: "아레나 관리", icon: "🏆" },
    { href: "/admin/popup", label: "팝업관리", icon: "📢", masterOnly: true },
  ];
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-gray-200 bg-white pc:flex">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="text-xs font-bold uppercase tracking-wider text-red-600">
          {isMaster ? "Master" : "관리부서"}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-gray-900" title={sessionEmail}>
          {sessionEmail}
        </div>
      </div>
      <nav aria-label="관리자 메뉴" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items
          .filter((it) => isMaster || !it.masterOnly)
          .map((it) => {
            const on = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold ${
                  on ? "bg-red-50 text-red-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span aria-hidden>{it.icon}</span>
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {(it.badge ?? 0) > 0 && (
                  <span
                    className="rounded-full border border-amber-300 bg-amber-100 px-1.5 text-px-11 font-bold tabular-nums text-amber-800"
                    aria-label={`승인 대기 ${it.badge}명`}
                  >
                    {it.badge}
                  </span>
                )}
              </Link>
            );
          })}
        {isMaster && (
          <>
            <div className="px-3 pb-1 pt-4 text-px-11 font-bold text-gray-400">바로가기</div>
            <Link
              href="/trainer"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <span aria-hidden>📊</span>
              <span>트레이너 페이지</span>
            </Link>
          </>
        )}
      </nav>
      <div className="border-t border-gray-100 px-5 py-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
