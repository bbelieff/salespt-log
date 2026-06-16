/**
 * /admin 공용 레이아웃 — 관리자 구역에 '당겨서 새로고침' 추가(admin-loading-and-ptr).
 *
 * ※ LoadingProvider 는 root providers.tsx 에 이미 전역 마운트(QueryClientProvider 안)
 *   되어 /admin 도 자동 커버 → 여기서 중복 추가하지 않음(이중 오버레이 방지).
 *   관리자 client 액션은 useGlobalLoading()(전역 컨텍스트)을 그대로 쓴다.
 * 권한 가드는 각 admin 페이지가 canViewAdminPages 로 처리 → 레이아웃은 셸만.
 */
import PullToRefresh from "@/components/PullToRefresh";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* 모바일 당겨서 새로고침 — PC/모달/가로 스와이프 가드 내장(수강생과 동일). */}
      <PullToRefresh />
    </>
  );
}
