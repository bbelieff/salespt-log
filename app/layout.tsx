import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Analytics from "@/components/Analytics";

// 전체 앱 기본 폰트 — Noto Sans KR.
// 중요도별 weight 정책: 400(본문)/500(미세)/600(중간)/700(강조)/800(중요)/900(최상위)
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://salesptlog.online"),
  title: "세일즈PT 경영일지",
  description: "수강생을 위한 직관적인 영업 현황 기록 · 대시보드",
  // 아이콘은 Next.js 가 app/icon.tsx, app/apple-icon.tsx 에서 자동 등록.
  // OG 이미지는 app/opengraph-image.tsx 에서 자동 등록 (카톡·페북·트위터 썸네일).
  // manifest 도 app/manifest.ts 에서 자동 주입.
  openGraph: {
    title: "세일즈PT 경영일지",
    description: "수강생을 위한 직관적인 영업 현황 기록 · 대시보드",
    url: "https://salesptlog.online",
    siteName: "세일즈PT 경영일지",
    locale: "ko_KR",
    type: "website",
    // images 는 app/opengraph-image.tsx 가 자동 주입.
  },
  twitter: {
    card: "summary_large_image",
    title: "세일즈PT 경영일지",
    description: "수강생을 위한 직관적인 영업 현황 기록 · 대시보드",
  },
  appleWebApp: {
    capable: true,
    title: "경영일지",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#d71617",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKR.variable}>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
