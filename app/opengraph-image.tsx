/**
 * Open Graph Image — 카카오톡·트위터·페이스북 등 링크 공유 시 노출.
 *
 * Next.js 가 빌드 시 자동으로 정적 PNG 생성 + <meta property="og:image">
 * 와 <meta name="twitter:image"> 메타 태그를 root metadata 로 주입.
 *
 * 디자인: 앱 아이콘(반반 타일 $, app/icon.svg 를 그대로 읽음) + "세일즈PT 경영일지" 워드마크.
 * Kakao 권장: 1200x630 (16:9 비율 안전).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** 파비콘과 같은 파일을 읽어 쓴다 — 아이콘이 바뀌면 썸네일도 같이 바뀐다. */
const ICON = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "app/icon.svg")).toString("base64")}`;

export const alt = "세일즈PT 경영일지 — 수강생을 위한 직관적인 영업 현황 기록·대시보드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        {/* 배경 그라데이션 강조 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(ellipse 60% 50% at 20% 20%, rgba(215,22,23,0.10) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 80% 80%, rgba(255,107,107,0.08) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* 로고 — 앱 아이콘(반반 타일 $)과 같은 원본. 모서리 30% = 아이콘 판과 같은 둥글기 */}
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 66,
            display: "flex",
            boxShadow: "0 20px 60px rgba(17,17,17,0.22), 0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ICON} width={220} height={220} alt="" />
        </div>

        {/* 워드마크 */}
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: "#111111",
              letterSpacing: -3,
            }}
          >
            세일즈PT
          </span>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#d71617",
              letterSpacing: -2,
            }}
          >
            경영일지
          </span>
        </div>

        {/* 부제 */}
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "#666666",
            fontWeight: 500,
            letterSpacing: -0.5,
            zIndex: 1,
            display: "flex",
          }}
        >
          수강생을 위한 직관적인 영업 현황 기록 · 대시보드
        </div>
      </div>
    ),
    size,
  );
}
