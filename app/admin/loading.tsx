/**
 * /admin 및 모든 하위(/admin/users·trainers·cohorts·arena·popup) 네비게이션 로딩
 * fallback. 하위 페이지가 force-dynamic + Sheets fetch 라 전환이 느려, loading.tsx
 * 부재 시 클릭해도 이전 화면이 유지돼 "안 눌린" 것처럼 보였다(재클릭 유발).
 * 수강생 화면과 동일한 브랜드 오버레이로 통일(admin-loading-and-ptr).
 */
import LoadingOverlay from "@/components/ui/LoadingOverlay";

export default function AdminLoading() {
  return <LoadingOverlay message="불러오고 있어요" />;
}
