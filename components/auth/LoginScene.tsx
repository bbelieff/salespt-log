/**
 * LoginScene — 인트로 + Google 로그인.
 * SSOT: docs/design/prototypes/login.html (v10 — 로고 + 글래스 도넛 + 8 이모지)
 */
"use client";

import { signIn } from "next-auth/react";
import WebviewWarning from "./WebviewWarning";

const FLUENT = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";
const EMOJIS = [
  { src: `${FLUENT}/Telephone%20receiver/3D/telephone_receiver_3d.png`, label: "컨택" },
  { src: `${FLUENT}/Clipboard/3D/clipboard_3d.png`, label: "일정" },
  { src: `${FLUENT}/Spiral%20calendar/3D/spiral_calendar_3d.png`, label: "캘린더" },
  { src: `${FLUENT}/Money%20bag/3D/money_bag_3d.png`, label: "수납" },
  { src: `${FLUENT}/Card%20index%20dividers/3D/card_index_dividers_3d.png`, label: "DB" },
  { src: `${FLUENT}/Bar%20chart/3D/bar_chart_3d.png`, label: "" },
  { src: `${FLUENT}/Rocket/3D/rocket_3d.png`, label: "" },
  { src: `${FLUENT}/Bullseye/3D/bullseye_3d.png`, label: "" },
];

const POS = [
  { x: 0, y: -1 }, { x: 0.707, y: -0.707 }, { x: 1, y: 0 }, { x: 0.707, y: 0.707 },
  { x: 0, y: 1 }, { x: -0.707, y: 0.707 }, { x: -1, y: 0 }, { x: -0.707, y: -0.707 },
];

export default function LoginScene() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-white">
      {/* in-app 웹뷰(카톡·네이버·인스타 등) 감지 시 오버레이로 외부 브라우저 유도. */}
      <WebviewWarning />

      {/* aurora bg */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(215,22,23,0.10) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 80% 30%, rgba(255,107,107,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 50% 100%, rgba(0,0,0,0.04) 0%, transparent 60%), linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)",
          animation: "auroraShift 14s ease-in-out infinite alternate",
        }}
      />
      <style>{`
        @keyframes auroraShift { 0% {transform:scale(1) rotate(0deg);filter:hue-rotate(0deg)} 100% {transform:scale(1.1) rotate(2deg);filter:hue-rotate(-8deg)} }
        @keyframes auraPulse { 0%,100% {transform:scale(1);opacity:.6} 50% {transform:scale(1.15);opacity:1} }
        @keyframes logoBreathe { 0%,100% {transform:translateY(0) scale(1)} 50% {transform:translateY(-6px) scale(1.02)} }
        @keyframes donutPulse { 0%,100% {transform:scale(1);opacity:.95} 50% {transform:scale(1.02);opacity:1} }
        @keyframes emojiPop { 0% {opacity:0;transform:scale(0)} 60% {opacity:1;transform:scale(1.15)} 100% {opacity:1;transform:scale(1)} }
        @keyframes emojiFloat { 0%,100% {translate:0 0} 50% {translate:0 -8px} }
      `}</style>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col px-8 pb-8">
        {/* logo stage */}
        <div
          className="relative flex flex-1 items-center justify-center py-12"
          style={
            {
              ["--r" as never]: "min(140px, 38vw)",
              ["--rd" as never]: "calc(var(--r) * 0.707)",
            } as React.CSSProperties
          }
        >
          {/* aura */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: 420,
              height: 420,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at center, rgba(215,22,23,0.18) 0%, rgba(215,22,23,0.08) 30%, transparent 70%)",
              filter: "blur(20px)",
              animation: "auraPulse 4s ease-in-out infinite",
            }}
          />

          {/* glass donut */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: "calc(var(--r) * 2 + 100px)",
              height: "calc(var(--r) * 2 + 100px)",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(147,197,253,0.35) 0%, rgba(96,165,250,0.20) 50%, rgba(191,219,254,0.40) 100%)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,0.5)",
              boxShadow:
                "0 12px 40px rgba(59,130,246,0.18), 0 4px 12px rgba(59,130,246,0.10), inset 0 1px 1px rgba(255,255,255,0.6)",
              mask: "radial-gradient(circle at center, transparent calc(var(--r) - 44px), black calc(var(--r) - 42px))",
              WebkitMask:
                "radial-gradient(circle at center, transparent calc(var(--r) - 44px), black calc(var(--r) - 42px))",
              animation: "donutPulse 6s ease-in-out infinite",
            }}
          />

          {/* 8 emojis */}
          {EMOJIS.map((e, i) => {
            const isDeco = i >= 5;
            const size = isDeco ? 44 : 56;
            const half = size / 2;
            const p = POS[i]!;
            const popDelay = 1.0 + i * 0.15;
            const floatDur = 4 + (i % 3) * 0.5;
            return (
              <div
                key={i}
                className="pointer-events-none absolute"
                style={{
                  width: size,
                  height: size,
                  marginLeft: -half,
                  marginTop: -half,
                  top: `calc(50% + ${p.y === 0 ? "0px" : `var(--${p.y === -1 || p.y === 1 ? "r" : "rd"}) * ${p.y < 0 ? -1 : 1}`})`,
                  left: `calc(50% + ${p.x === 0 ? "0px" : `var(--${p.x === -1 || p.x === 1 ? "r" : "rd"}) * ${p.x < 0 ? -1 : 1}`})`,
                  opacity: 0,
                  animation: `emojiPop 0.8s cubic-bezier(.2,1.6,.4,1) ${popDelay}s forwards, emojiFloat ${floatDur}s ease-in-out ${popDelay + 1}s infinite`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.src}
                  alt={e.label}
                  className="h-full w-full"
                  style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.18))" }}
                />
              </div>
            );
          })}

          {/* logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/salespt-logo.png"
            alt="세일즈PT"
            className="relative z-10"
            style={{
              width: "80%",
              maxWidth: 220,
              height: "auto",
              filter:
                "drop-shadow(0 12px 32px rgba(215,22,23,0.10)) drop-shadow(0 4px 12px rgba(0,0,0,0.05))",
              animation: "logoBreathe 5s ease-in-out infinite",
            }}
          />
        </div>

        {/* welcome */}
        <div className="text-center">
          <h1 className="text-[22px] font-bold leading-snug tracking-tight text-gray-900">
            세일즈피티 경영일지에
            <br />
            오신 걸 환영합니다
          </h1>
        </div>

        {/* google button */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-gray-300 bg-white text-[15px] font-medium text-gray-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md active:scale-[0.99]"
          style={{ height: 52, fontFamily: "Roboto, 'Noto Sans KR', sans-serif" }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span>Google 계정으로 로그인</span>
        </button>

        <div className="mt-4 text-center text-[11px] text-gray-400">
          세일즈피티 수강생 전용 · v1.0
        </div>
      </div>
    </main>
  );
}
