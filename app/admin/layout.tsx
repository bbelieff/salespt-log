/**
 * /admin 공용 레이아웃 — 관리자 구역에 '당겨서 새로고침' 추가(admin-loading-and-ptr)
 * + PC(1024px+) 왼쪽 메뉴(admin-side-nav, 2026-11-03).
 *
 * ※ LoadingProvider 는 root providers.tsx 에 이미 전역 마운트(QueryClientProvider 안)
 *   되어 /admin 도 자동 커버 → 여기서 중복 추가하지 않음(이중 오버레이 방지).
 *   관리자 client 액션은 useGlobalLoading()(전역 컨텍스트)을 그대로 쓴다.
 * 권한 가드(admin-phase1, 2026-11-16): 여기서 먼저 막는다 — 마스터·관리부서(canViewAdminPages)가
 *   아니면 "/" 로 보낸다. 새 관리자 화면이 가드를 빠뜨려도 열리지 않게 하는 바닥이다.
 *   각 페이지의 가드(마스터 전용 화면은 isAdminEmail)는 그대로 둔다 — 레이아웃 가드는 그걸 대신하지 않는다.
 *   route handler(/admin/me)는 레이아웃을 타지 않으므로 예전 동작 그대로다.
 * 승인 대기 수는 service getAdminPendingCounts(홈과 같은 registry 캐시) — 실패해도 화면은 뜬다.
 */
import { redirect } from "next/navigation";
import PullToRefresh from "@/components/PullToRefresh";
import AdminSideNav from "@/components/auth/AdminSideNav";
import { getSessionEmail, canViewAdminPages, isAdminEmail } from "@/auth/identity";
import { getAdminPendingCounts } from "@/service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");
  const pending = await getAdminPendingCounts();

  return (
    <div className="pc:flex">
      <AdminSideNav
        sessionEmail={sessionEmail}
        isMaster={isAdminEmail(sessionEmail)}
        pendingTrainees={pending.trainees}
        pendingTrainers={pending.trainers}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {/* 모바일 당겨서 새로고침 — PC/모달/가로 스와이프 가드 내장(수강생과 동일). */}
      <PullToRefresh />
    </div>
  );
}
