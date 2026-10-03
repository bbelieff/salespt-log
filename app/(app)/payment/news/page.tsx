/** 정책자금 데일리 — 공개 원문 전체 기능을 최소 권한 iframe으로 앱 안에 표시한다. */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import { POLICY_NEWS_URL } from "@/config/links";
import PolicyNewsEmbed from "./PolicyNewsEmbed";

function ExternalArrow() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

export default function PolicyNewsPage() {
  return (
    <div
      data-policy-news-desktop-shell
      className="pc:flex pc:h-dvh pc:min-h-0 pc:flex-col pc:overflow-hidden"
    >
      <TopHeader pageEmoji="📰" pageTitle="정책자금 데일리" pageSubtitle="매일 자동 수집" />
      <div className="px-4 pb-10 pt-3 pc:flex pc:min-h-0 pc:flex-1 pc:flex-col pc:overflow-hidden pc:pb-3">
        <PageContainer width="xwide" className="pc:flex pc:h-full pc:min-h-0 pc:flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="min-w-0 truncate text-sm text-slate-500">
              출처 <span className="font-semibold text-slate-700">salesptlog.online/news</span>
            </p>
            <a href={POLICY_NEWS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-brand-red px-4 text-sm font-bold text-white transition-colors hover:bg-red-700">
              새 창에서 열기
              <ExternalArrow />
            </a>
          </div>
          <div className="pc:min-h-0 pc:flex-1">
            <PolicyNewsEmbed src={POLICY_NEWS_URL} />
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
