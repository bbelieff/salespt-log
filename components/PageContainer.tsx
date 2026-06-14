/**
 * PageContainer — 반응형 페이지 폭 컨테이너 (데스크탑 가독성).
 *
 * 문제: 브레이크포인트가 전부 모바일(xs~2xl)이라 데스크탑에서 모바일 레이아웃이
 *       화면 전체로 늘어나 가독성↓. → pc(1024)/wide(1280) 에서 폭을 제어.
 *
 * 모바일(<768): 풀폭. 중간폭(md 768~1024): 가운데 정렬 + 폭 캡(1단인데 폭 무제한이라
 *   퍼널·추이·채널 카드가 과대해지던 문제 — dashboard-intermediate-width-cap).
 *   데스크탑(pc 1024↑): 기존 폭/내부 멀티컬럼 그대로.
 *
 * width:
 *  - "narrow" 입력 중심(컨택·일정·DB·로그인/온보딩) → 읽기 좋은 좁은 폭.
 *  - "wide"   정보 많은 화면(실무수납·대시보드·관리자) → 넓은 폭 + 내부 멀티컬럼.
 *  - "xwide"  캘린더처럼 좌우로 더 열어야 하는 화면 → 가장 넓은 폭(pc:max-w-[120rem], 사실상 화면폭-여백).
 *
 * 등재: docs/design/components.md §8.
 */
export default function PageContainer({
  width = "narrow",
  className = "",
  children,
}: {
  width?: "narrow" | "wide" | "xwide";
  className?: string;
  children: React.ReactNode;
}) {
  // md 중간 캡: 768~1024 구간에서 1단 카드가 화면 전체로 늘어나지 않게 폭 제한.
  // 캘린더(xwide)는 좌우로 열려야 하므로 중간 캡도 너무 좁지 않게(2xl).
  const maxW =
    width === "xwide"
      ? "md:max-w-2xl pc:max-w-[120rem]"
      : width === "wide"
        ? "md:max-w-2xl pc:max-w-6xl"
        : "md:max-w-md pc:max-w-2xl";
  return (
    <div className={`mx-auto w-full ${maxW} md:px-4 pc:px-6 wide:px-8 ${className}`}>
      {children}
    </div>
  );
}
