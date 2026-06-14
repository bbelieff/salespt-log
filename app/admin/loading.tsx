/**
 * /admin 및 모든 하위(/admin/users·trainers·cohorts·arena·popup) 네비게이션 로딩
 * fallback. 하위 페이지가 force-dynamic + Sheets fetch 라 전환이 느려, loading.tsx
 * 부재 시 클릭해도 이전 화면이 유지돼 "안 눌린" 것처럼 보였다(재클릭 유발).
 * 이 즉시 스피너로 클릭 1회에 반응이 명확해진다(admin-nav-loading).
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-red"
        role="status"
        aria-label="불러오는 중"
      />
    </div>
  );
}
