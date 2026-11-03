/**
 * /admin 공용 레이아웃 — 관리자 구역에 '당겨서 새로고침' 추가(admin-loading-and-ptr)
 * + PC(1024px+) 왼쪽 메뉴(admin-side-nav, 2026-11-03).
 *
 * ※ LoadingProvider 는 root providers.tsx 에 이미 전역 마운트(QueryClientProvider 안)
 *   되어 /admin 도 자동 커버 → 여기서 중복 추가하지 않음(이중 오버레이 방지).
 *   관리자 client 액션은 useGlobalLoading()(전역 컨텍스트)을 그대로 쓴다.
 * 권한 가드는 각 admin 페이지가 canViewAdminPages 로 처리 → 레이아웃은 셸만.
 * 메뉴는 관리자 화면을 볼 수 있는 계정에만 그린다(아니면 페이지가 redirect).
 * 승인 대기 수는 service getAdminPendingCounts(홈 카드와 같은 registry 캐시) — 실패해도 화면은 뜬다.
 */
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
  const canView = !!sessionEmail && (await canViewAdminPages(sessionEmail));
  const pending = canView ? await getAdminPendingCounts() : { trainees: 0, trainers: 0 };

  return (
    <div className="pc:flex">
      {canView && (
        <AdminSideNav
          sessionEmail={sessionEmail!}
          isMaster={isAdminEmail(sessionEmail)}
          pendingTrainees={pending.trainees}
          pendingTrainers={pending.trainers}
        />
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {/* 모바일 당겨서 새로고침 — PC/모달/가로 스와이프 가드 내장(수강생과 동일). */}
      <PullToRefresh />
    </div>
  );
}
