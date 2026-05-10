/**
 * Google Analytics 4 (gtag.js) — production only.
 *
 * NEXT_PUBLIC_GA_ID 가 설정된 경우에만 스크립트 로드.
 * dev/local 에서는 자동으로 비활성 (실제 트래픽 오염 방지).
 *
 * Next.js 15 App Router 권장 패턴: next/script + strategy="afterInteractive"
 */
import Script from "next/script";

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
