/**
 * 정책자금 데일리 — PC 사이드바 「실무/수납 > 정책자금뉴스」 진입점.
 *
 * 폰에서도 열리는 정상 라우트다. 폰용 별도 처리 없음.
 * 뉴스 정적 페이지는 현재 same-origin frame-ancestors 정책으로 앱 안 표시가 허용된다.
 */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import { POLICY_NEWS_URL } from "@/config/links";
import PolicyNewsEmbed from "./PolicyNewsEmbed";

/** ↗ — 새 탭으로 열림 표시 (장식). 버튼 문구 「새 창에서 열기」와 짝. */
function ExternalArrow() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
      />
    </svg>
  );
}

export default function PolicyNewsPage() {
  return (
    <>
      <TopHeader
        pageEmoji="📰"
        pageTitle="정책자금 데일리"
        pageSubtitle="매일 자동 수집"
      />
      <div className="px-4 pb-10 pt-3">
        <PageContainer width="xwide">
          {/* 출처 + 새 창에서 열기 */}
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="min-w-0 truncate text-sm text-slate-500">
              출처{" "}
              <span className="font-semibold text-slate-700">
                salesptlog.online/news
              </span>
            </p>
            <a
              href={POLICY_NEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-brand-red px-4 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              새 창에서 열기
              <ExternalArrow />
            </a>
          </div>

          <PolicyNewsEmbed src={POLICY_NEWS_URL} />
        </PageContainer>
      </div>
    </>
  );
}
