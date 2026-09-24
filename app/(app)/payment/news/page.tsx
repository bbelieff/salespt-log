/**
 * 정책자금 데일리 — PC 사이드바 「실무/수납 > 정책자금뉴스」 진입점.
 *
 * 폰에서도 열리는 정상 라우트다. 폰용 별도 처리 없음.
 * EMBED=false(지금): 안내 카드 + 큰 「새 창에서 열기」 버튼만. 서버가
 * X-Frame-Options: DENY 를 보내 iframe 이 무조건 빈 화면이 되므로
 * iframe 을 렌더하지 않는다. Caddy 에서 /news/* 만 SAMEORIGIN 으로
 * 바꾼 뒤 POLICY_NEWS_EMBED 를 true 로 올린다(별도 1줄 PR).
 */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import { POLICY_NEWS_URL, POLICY_NEWS_EMBED } from "@/config/links";

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

          {POLICY_NEWS_EMBED ? (
            <iframe
              src={POLICY_NEWS_URL}
              className="h-[calc(100dvh-13rem)] w-full rounded-xl border border-slate-200"
              title="정책자금 데일리"
              loading="lazy"
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <p className="mb-1 text-base font-bold text-slate-900">
                정책자금 데일리는 아직 새 창에서 열립니다
              </p>
              <p className="mb-4 text-sm text-slate-500">
                앱 안에 바로 띄우는 준비를 하고 있어요. 아래 버튼으로 오늘
                소식을 확인해 주세요.
              </p>
              <a
                href={POLICY_NEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-red px-6 text-base font-bold text-white transition-colors hover:bg-red-700"
              >
                정책자금 데일리 새 창에서 열기
                <ExternalArrow />
              </a>
            </div>
          )}
        </PageContainer>
      </div>
    </>
  );
}
