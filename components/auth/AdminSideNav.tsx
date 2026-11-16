/**
 * AdminSideNav — 관리자모드 PC(1024px+) 왼쪽 메뉴(admin-side-nav, 2026-11-03).
 *
 * 2026-11-16(admin-phase1): 메뉴를 다섯 묶음으로 — 운영 현황 · 사람 · 과정 · 알림 · 설정.
 * 목록은 lib/config/admin-nav.ts 한 곳(폰 메뉴 AdminMenuList 와 공유).
 * 승인 대기 수는 메뉴 옆 숫자로 늘 보인다. 1024px 미만은 렌더 안 함(폰은 홈의 AdminMenuList).
 * 캡쳐해서 공지하는 화면(아레나 전광판·공유왕)은 메뉴 없이 둔다 — 캡쳐에 찍히지 않게.
 * 권한 가드는 레이아웃·각 페이지가 맡는다. 여기선 마스터 전용 항목만 숨긴다.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminNavActive, visibleAdminNavGroups } from "@/config/admin-nav";
import LogoutButton from "./LogoutButton";

/** 메뉴 없이 보여 줄 화면 — 캡쳐용. */
const BARE_PREFIXES = ["/admin/arena/scoreboard", "/admin/arena/share-scores"];

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
  const badgeOf = { trainees: pendingTrainees, trainers: pendingTrainers };

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-slate-200 bg-white pc:flex">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-xs font-bold uppercase tracking-wider text-red-600">
          {isMaster ? "Master" : "관리부서"}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={sessionEmail}>
          {sessionEmail}
        </div>
      </div>
      <nav aria-label="관리자 메뉴" className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {visibleAdminNavGroups(isMaster).map((g) => (
          <div key={g.key} role="group" aria-label={g.label}>
            <div className="flex items-center gap-1.5 px-3 pb-1 text-px-11 font-bold text-slate-400">
              <span aria-hidden>{g.icon}</span>
              <span>{g.label}</span>
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const on = isAdminNavActive(it.href, pathname);
                const badge = it.badge ? badgeOf[it.badge] : 0;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold ${
                      on ? "bg-red-50 text-red-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {badge > 0 && (
                      <span
                        className="rounded-full border border-amber-300 bg-amber-100 px-1.5 text-px-11 font-bold tabular-nums text-amber-800"
                        aria-label={`승인 대기 ${badge}명`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-5 py-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
