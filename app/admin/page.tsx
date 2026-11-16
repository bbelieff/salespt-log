/**
 * /admin — 관리자 홈 「오늘 할 일」(admin-phase1, 2026-11-16).
 *
 * 예전의 메뉴 카드 6장(왼쪽 메뉴와 같은 내용)을 걷어내고, 지금 처리할 일의 숫자와 그 화면으로 가는
 * 링크를 보여 준다: 승인 대기 수강생·트레이너, 담당 없는 활성 수강생, 기수 생성 실패분(있을 때만), 새 오류 신고.
 * 폰·태블릿은 왼쪽 메뉴가 없으므로 아래에 같은 다섯 묶음 메뉴(AdminMenuList)를 둔다.
 * DB 상태 띠는 설정 > 진단(/admin/settings)으로 옮겼다.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  getActiveUserEmail,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { getAdminTodoCounts } from "@/service";
import LogoutButton from "@/components/auth/LogoutButton";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";
import AdminTodoList from "@/components/auth/AdminTodoList";
import AdminMenuList from "@/components/auth/AdminMenuList";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) {
    redirect("/");
  }
  const isMaster = isAdminEmail(sessionEmail);
  const activeEmail = await getActiveUserEmail();
  const impersonating = activeEmail !== sessionEmail ? activeEmail : null;
  const counts = await getAdminTodoCounts();

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 pc:hidden">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              {isMaster ? "Master" : "관리부서"}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {sessionEmail}
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-6 py-8 pc:max-w-5xl">
        {impersonating && <ImpersonationBanner impersonating={impersonating} />}

        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">운영 현황</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {isMaster
              ? "지금 처리할 일이에요. 줄을 누르면 그 화면으로 가요."
              : "지금 처리할 일이에요. 관리부서 계정은 조회만 할 수 있어요."}
          </p>
        </div>

        <AdminTodoList counts={counts} />
        <AdminMenuList
          isMaster={isMaster}
          pendingTrainees={counts.pendingTrainees ?? 0}
          pendingTrainers={counts.pendingTrainers ?? 0}
        />
      </div>
    </main>
  );
}
