import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
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
