import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  // 동적 클래스 safelist (계약수납 v9 — 슬롯 색상 + 카드 좌측 보더)
  // SLOT_STYLES 상수와 1:1 매칭. 코드에서 문자열 조합으로 만들어지므로 명시 필요.
  safelist: [
    // 수납 1 = teal / 수납 2 = cyan / 수납 3 = fuchsia
    "bg-teal-100", "bg-teal-300", "bg-teal-500", "bg-teal-600", "bg-teal-700",
    "text-teal-700",
    "bg-cyan-100", "bg-cyan-300", "bg-cyan-500", "bg-cyan-600", "bg-cyan-700",
    "text-cyan-700",
    "bg-fuchsia-100", "bg-fuchsia-300", "bg-fuchsia-500", "bg-fuchsia-600", "bg-fuchsia-700",
    "text-fuchsia-700",
    // 카드 좌측 보더 (활성 슬롯 색)
    "border-l-4",
    "border-l-teal-500", "border-l-cyan-500", "border-l-fuchsia-500", "border-l-green-500",
  ],
  theme: {
    // 모바일 우선 브레이크포인트 — display-reference-v2.html 매핑
    // (수강생 기기: iPhone 12~17 / Galaxy S21~S26 = 360~480px)
    screens: {
      xs: "360px", // Galaxy S22~S26 기본 (최소 폭)
      sm: "390px", // iPhone 12~16, 16e, 17e
      md: "402px", // iPhone 17 / 17 Pro / 16 Pro
      lg: "430px", // iPhone Pro Max / Plus
      xl: "480px", // Galaxy S25/S26 Ultra (QHD+)
      "2xl": "768px", // 태블릿 진입
    },
    extend: {
      fontFamily: {
        // 전체 앱 기본 폰트: Noto Sans KR (한국어 가독성 + 전체 일관성)
        // next/font/google이 CSS 변수 --font-noto-sans-kr로 노출.
        // Pretendard, system-ui는 fallback (네트워크 실패 대비).
        sans: [
          "var(--font-noto-sans-kr)",
          "Pretendard",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // 명시적 alias — 코드에서 font-noto로 호출 가능 (의도 명확).
        noto: ["var(--font-noto-sans-kr)", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f5f7ff",
          500: "#5b6cff",
          600: "#4a59e6",
          700: "#3644b8",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
