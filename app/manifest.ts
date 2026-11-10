/**
 * PWA manifest — "홈 화면에 추가" 경험.
 *
 * Next.js 15 가 자동으로 <link rel="manifest"> 주입.
 *
 * 모바일에서 즐겨찾기 → 홈 추가 시:
 *   - 이름: "세일즈PT 경영일지"
 *   - 아이콘: app/icon.tsx + app/apple-icon.tsx
 *   - 시작 URL: /
 *   - display: standalone (네이티브 앱처럼 보임)
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "세일즈PT 경영일지",
    short_name: "경영일지",
    description: "세일즈피티 수강생 전용 — 4가지 지표 기록 + 대시보드",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d71617",
    // 안드로이드는 앱 아이콘으로 열 때 시작 화면(배경색 + 이 아이콘)을 강제로 띄운다.
    // 아이콘은 아이폰과 같은 빨간 $, 시작 화면 배경은 흰색 = 우리 첫 로딩 화면(흰 바탕 + 로고 링)과 같은 바탕으로 맞춰
    // 두 화면이 하나로 이어져 보이게 한다(2026-11-10).
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
