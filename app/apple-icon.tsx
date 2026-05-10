/**
 * Apple touch icon — iOS 홈화면 추가 시 사용 (180x180).
 *
 * Next.js 15 가 자동으로 <link rel="apple-touch-icon"> 주입.
 * iOS 가 자동 둥근 모서리 처리하므로 둥근 보더 X.
 */
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #ff3838 0%, #d71617 100%)",
          color: "white",
          fontSize: 140,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          letterSpacing: -6,
        }}
      >
        $
      </div>
    ),
    size,
  );
}
