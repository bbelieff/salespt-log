/**
 * PageContainer — 반응형 페이지 폭 컨테이너 (데스크탑 가독성).
 *
 * 모바일(<768): 풀폭. 중간폭(md 768~1024): 가운데 정렬 + 폭 캡(1단인데 폭 무제한이라
 *   퍼널·추이·채널 카드가 과대해지던 문제 — dashboard-intermediate-width-cap).
 *   데스크탑(pc 1024↑): 기존 폭/내부 멀티컬럼 그대로.
 *
 * width:
 *  - "narrow" 입력 중심(컨택·일정·DB·로그인/온보딩) → 읽기 좋은 좁은 폭.
 *  - "wide"   정보 많은 화면(실무수납·대시보드·관리자) → 넓은 폭 + 내부 멀티컬럼.
 *  - "xwide"  캘린더처럼 좌우로 더 열어야 하는 화면 → 가장 넓은 폭(pc:max-w-[120rem], 사실상 화면폭-여백).
 *  - "fluid"  학생 데스크탑 셸(.desktop-shell) 전용 — pc 캡 해제(pc:max-w-none)로
 *    사이드바(224px) 제외 잔여폭을 전부 사용. 모바일·태블릿(<1024)은 wide 와
 *    동일(md:max-w-2xl)이라 기존 레이아웃 그대로. 균일 거터 pc:px-6(≈20px).
 *    admin/trainer/auth 경로는 narrow/wide/xwide 를 유지한다(캡 보존).
 *
 * 등재: docs/design/components.md §8.
 */
export default function PageContainer({
  width = "narrow",
  className = "",
  children,
}: {
  width?: "narrow" | "wide" | "xwide" | "fluid";
  className?: string;
  children: React.ReactNode;
}) {
  // md 중간 캡: 768~1024 구간에서 1단 카드가 화면 전체로 늘어나지 않게 폭 제한.
  // 캘린더(xwide)는 좌우로 열려야 하므로 중간 캡도 너무 좁지 않게(2xl).
  // fluid: 태블릿까지는 wide 와 동일한 캡(md:max-w-2xl) — 모바일·태블릿 무변경.
  // pc에서는 캡 해제 + 균일 거터(아래 padding 분기).
  const maxW =
    width === "fluid"
      ? "md:max-w-2xl pc:max-w-none"
      : width === "xwide"
        ? "md:max-w-2xl pc:max-w-[120rem]"
        : width === "wide"
          ? "md:max-w-2xl pc:max-w-6xl"
          : "md:max-w-md pc:max-w-2xl";
  // fluid 거터는 pc:px-6 으로 고정 — wide:px-8(≈27px+) 확장을 쓰지 않아
  // 헤더·배너·본문이 같은 16–24px 거터로 정렬된다(tokens.md 컨테이너).
  const gutter =
    width === "fluid" ? "md:px-4 pc:px-6" : "md:px-4 pc:px-6 wide:px-8";
  return (
    <div className={`mx-auto w-full ${maxW} ${gutter} ${className}`}>
      {children}
    </div>
  );
}
