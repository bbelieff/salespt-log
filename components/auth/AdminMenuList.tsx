/**
 * AdminMenuList — 폰·태블릿(1024px 미만) 관리자 메뉴(admin-phase1, 2026-11-16).
 *
 * PC 는 왼쪽 메뉴(AdminSideNav)가 있어 숨긴다(`pc:hidden`). 같은 다섯 묶음을 관리자 홈 아래에 줄로 보여 준다.
 * 목록은 lib/config/admin-nav.ts — 마스터 전용 항목은 관리부서 계정에 안 보인다.
 */
import Link from "next/link";
import { visibleAdminNavGroups } from "@/config/admin-nav";

export default function AdminMenuList({
  isMaster,
  pendingTrainees = 0,
  pendingTrainers = 0,
}: {
  isMaster: boolean;
  pendingTrainees?: number;
  pendingTrainers?: number;
}) {
  const badgeOf = { trainees: pendingTrainees, trainers: pendingTrainers };
  return (
    <nav aria-label="관리자 메뉴" className="surface-panel pc:hidden">
      <h2 className="section-head">메뉴</h2>
      <div className="divide-y divide-slate-100">
        {visibleAdminNavGroups(isMaster)
          .map((g) => ({ ...g, items: g.items.filter((it) => it.href !== "/admin") }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.key} role="group" aria-label={g.label} className="py-2">
              <div className="flex items-center gap-1.5 text-px-11 font-bold text-slate-400">
                <span aria-hidden>{g.icon}</span>
                <span>{g.label}</span>
              </div>
              {g.items.map((it) => {
                const badge = it.badge ? badgeOf[it.badge] : 0;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-800 hover:text-red-600"
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
                    <span aria-hidden className="text-slate-300">›</span>
                  </Link>
                );
              })}
            </div>
          ))}
      </div>
    </nav>
  );
}
