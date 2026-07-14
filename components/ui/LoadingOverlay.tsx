/**
 * LoadingOverlay — 전역 로딩 팝업 (loading-overlay / v3 글로우 링).
 *
 * 라이트 프로스트 글래스 카드(반투명 흰색+blur+빨강 글로우) + 회전 conic 광선 링 + 궤도 점 +
 * 가운데 **세일즈PT 로고**(원본 PNG, 무가공) 호흡 + 문구 크로스페이드 + 하단 진행 라인 sweep.
 * 화면 정중앙 고정(fixed z-[400], 배경 dim, safe-area 무시 전체 덮기). 모바일·PC 동일.
 * 접근성: role=status aria-live=polite. 로고는 장식(alt="") — 문구는 aria-label 이 읽는다.
 * prefers-reduced-motion 이면 globals.css 가 키프레임 비활성(정적 점/문구).
 * 키프레임·글래스 토큰 = globals.css `.lo-*` (tokens.md 'overlay 토큰').
 *
 * 2026-07-15: 중앙 'S' → 로고 전체(심볼 + "세일즈PT" 워드마크)로 교체. 로고 글자가 검정이라
 * 다크 카드에선 묻혀서, **에셋 대신 카드를 라이트로** 바꿨다(belie 지시). 문구색도 다크 잉크로 동반 전환.
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
      <div className="lo-card relative flex w-auto min-w-56 max-w-sm flex-col items-center gap-4 rounded-2xl px-8 py-7">
        <div className="lo-ring relative h-24 w-24">
          <span className="lo-ring-spin absolute inset-0 rounded-full" aria-hidden />
          <span className="lo-orbit absolute inset-0" aria-hidden />
          <span className="lo-core absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/salespt-logo.png" alt="" className="object-contain" aria-hidden />
          </span>
        </div>
        <p key={message} className="lo-msg whitespace-nowrap text-center text-sm font-bold text-gray-800">
          {message}
        </p>
        <span className="lo-progress" aria-hidden />
      </div>
    </div>
  );
}
