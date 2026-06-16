/**
 * LoadingOverlay — 전역 로딩 팝업 (loading-overlay / v3 글로우 링).
 *
 * 다크 글래스 카드(반투명+blur+빨강 글로우) + 회전 conic 광선 링 + 궤도 점 +
 * 가운데 'S' 마크 호흡 + 문구 크로스페이드 + 하단 진행 라인 sweep.
 * 화면 정중앙 고정(fixed z-[400], 배경 dim, safe-area 무시 전체 덮기). 모바일·PC 동일.
 * 접근성: role=status aria-live=polite. prefers-reduced-motion 이면 globals.css 가
 * 키프레임 비활성(정적 점/문구). 키프레임·글래스 토큰 = globals.css `.lo-*`.
 *
 * 입자 퍼널 등으로 바꾸려면 이 컴포넌트 내부(.lo-ring 블록)만 교체.
 */
"use client";

export default function LoadingOverlay({
  message = "불러오고 있어요",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className="fixed inset-0 z-[400] flex items-center justify-center"
    >
      <div className="lo-dim absolute inset-0" />
      <div className="lo-card relative flex w-56 flex-col items-center gap-4 rounded-2xl px-8 py-7">
        <div className="lo-ring relative h-20 w-20">
          <span className="lo-ring-spin absolute inset-0 rounded-full" aria-hidden />
          <span className="lo-orbit absolute inset-0" aria-hidden />
          <span className="lo-core absolute inset-0 flex items-center justify-center text-2xl font-black text-white">
            S
          </span>
        </div>
        <p key={message} className="lo-msg text-center text-sm font-bold text-white/90">
          {message}
        </p>
        <span className="lo-progress" aria-hidden />
      </div>
    </div>
  );
}
