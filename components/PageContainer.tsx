/**
 * PageContainer — 반응형 페이지 폭 컨테이너 (데스크탑 가독성).
 *
 * 문제: 브레이크포인트가 전부 모바일(xs~2xl)이라 데스크탑에서 모바일 레이아웃이
 *       화면 전체로 늘어나 가독성↓. → pc(1024)/wide(1280) 에서 폭을 제어.
 *
 * 모바일: 풀폭(기존 그대로 유지). 데스크탑: 중앙정렬 + 폭 제한 + 좌우 여백.
 *
 * width:
 *  - "narrow" 입력 중심(컨택·일정·DB·로그인/온보딩) → 읽기 좋은 좁은 폭.
 *  - "wide"   정보 많은 화면(캘린더·실무수납·대시보드·관리자) → 넓은 폭 + 내부 멀티컬럼.
 *
 * 등재: docs/design/components.md §8.
 */
export default function PageContainer({
  width = "narrow",
  className = "",
  children,
}: {
  width?: "narrow" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  const maxW = width === "wide" ? "pc:max-w-6xl" : "pc:max-w-2xl";
  return (
    <div className={`mx-auto w-full ${maxW} pc:px-6 wide:px-8 ${className}`}>
      {children}
    </div>
  );
}
