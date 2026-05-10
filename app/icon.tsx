/**
 * App Icon — 브라우저 탭 / 즐겨찾기 (favicon).
 *
 * Next.js 15 가 자동으로 빌드 시 정적 PNG 로 변환:
 *   /icon  ← <link rel="icon"> 자동 주입
 *
 * 디자인: 빨간 사각 + 흰 $ (세일즈PT 로고의 핵심 모티프).
 */
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#d71617",
          color: "white",
          fontSize: 52,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          letterSpacing: -2,
        }}
      >
        $
      </div>
    ),
    size,
  );
}
