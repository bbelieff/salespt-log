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
    extend: {
      fontFamily: {
        sans: ["Pretendard", "ui-sans-serif", "system-ui", "sans-serif"],
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
