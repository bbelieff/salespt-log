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
    icons: [
      // Next.js 가 app/icon.tsx, app/apple-icon.tsx 를 자동 등록.
      // 별도 PNG 자산이 있으면 여기에 추가 (현재는 없음).
    ],
  };
}
