/**
 * WebviewWarning — 카카오톡·네이버·인스타·페북 등 in-app 브라우저 감지.
 *
 * 배경: Google OAuth 가 in-app webview 에서 "disallowed_useragent" 로 차단됨.
 * 트레이너·수강생이 카톡 링크로 들어오면 로그인 자체 불가.
 *
 * 동작:
 *   1. user agent 검사 → webview 인 경우 LoginScene 위에 풀스크린 오버레이 노출.
 *   2. 두 가지 액션:
 *      A) "외부 브라우저로 열기" 버튼 — KakaoTalk 안드로이드는 URL scheme 으로
 *         즉시 외부 Chrome 으로 점프. iOS·다른 webview 는 URL 복사 안내.
 *      B) URL 복사 버튼 — 어디서든 동작.
 *
 * 비-webview 환경에서는 null 반환 — LoginScene 그대로 노출.
 */
"use client";

import { useEffect, useState } from "react";

type Webview =
  | "kakao"
  | "naver"
  | "instagram"
  | "facebook"
  | "line"
  | null;

/**
 * 명시적 webview UA 만 매칭 — 정식 모바일 브라우저는 false-positive 방지.
 *
 * 이전 버전은 "iOS + Safari UA 아님" 을 generic webview 로 분류했는데,
 * iOS Chrome(CriOS) / Firefox(FxiOS) / Edge(EdgiOS) 정식 브라우저까지
 * 잘못 경고 노출. 카톡에서 "다른 브라우저로 열기" 한 사용자도 차단.
 * (사용자 보고: 2026-05, 크롬에서도 경고 그대로)
 */
function detect(ua: string): Webview {
  const s = ua.toLowerCase();
  if (s.includes("kakaotalk")) return "kakao";
  if (s.includes("naver")) return "naver";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("fban") || s.includes("fbav") || s.includes("fbsv")) return "facebook";
  if (s.includes(" line/")) return "line";
  return null;
}

const LABEL: Record<Exclude<Webview, null>, string> = {
  kakao: "카카오톡",
  naver: "네이버 앱",
  instagram: "인스타그램",
  facebook: "페이스북",
  line: "라인",
};

export default function WebviewWarning() {
  const [webview, setWebview] = useState<Webview>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWebview(detect(window.navigator.userAgent));
    setUrl(window.location.href);
  }, []);

  if (!webview) return null;

  const handleOpenExternal = () => {
    const target = window.location.href;
    if (webview === "kakao") {
      // KakaoTalk URL scheme — 안드로이드에서 외부 Chrome 으로 즉시 점프.
      // iOS 는 미지원 → fail silently, 사용자가 복사·붙여넣기.
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`;
      return;
    }
    // 다른 webview: 대부분 외부 열기 API 없음. 복사 트리거.
    handleCopy();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 일부 webview 는 clipboard API 차단 → 사용자 수동 선택 안내.
      window.prompt("URL을 복사해주세요:", url);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="mt-3 text-lg font-black text-gray-900">
            외부 브라우저로 열어주세요
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            현재 <strong>{LABEL[webview]}</strong> 내에서 열려있어
            <br />
            Google 로그인이 보안상 차단됩니다.
          </p>
        </div>

        {webview === "kakao" ? (
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={handleOpenExternal}
              className="w-full rounded-full bg-gray-900 py-3 text-sm font-bold text-white hover:bg-black active:scale-[0.99]"
            >
              크롬·사파리에서 열기
            </button>
            <p className="text-center text-[11px] text-gray-400">
              버튼이 동작하지 않으면 아래 URL을 복사해 브라우저에 붙여넣어주세요.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <ol className="space-y-1.5 rounded-xl bg-gray-50 p-4 text-[12px] leading-relaxed text-gray-700">
              <li>
                <strong>1.</strong> 화면 오른쪽 위{" "}
                <code className="rounded bg-white px-1">⋮</code> 또는{" "}
                <code className="rounded bg-white px-1">···</code> 버튼 클릭
              </li>
              <li>
                <strong>2.</strong> &quot;다른 브라우저로 열기&quot; 또는
                &quot;Chrome/Safari로 열기&quot; 선택
              </li>
            </ol>
            <p className="text-center text-[11px] text-gray-400">
              또는 URL을 복사해 직접 붙여넣기:
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-[11px] text-gray-700">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>
    </div>
  );
}
