/** 정책자금 데일리 — 공개 원문 전체 기능을 최소 권한 iframe으로 앱 안에 표시한다. */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import { POLICY_NEWS_URL } from "@/config/links";
import PolicyNewsEmbed from "./PolicyNewsEmbed";

export default function PolicyNewsPage() {
  return (
    <div
      data-policy-news-desktop-shell
      className="pc:flex pc:h-dvh pc:min-h-0 pc:flex-col pc:overflow-hidden"
    >
      <TopHeader pageEmoji="📰" pageTitle="정책자금 데일리" pageSubtitle="매일 자동 수집" />
      <div className="px-4 pb-10 pt-3 pc:flex pc:min-h-0 pc:flex-1 pc:flex-col pc:overflow-hidden pc:pb-3">
        <PageContainer width="xwide" className="pc:flex pc:h-full pc:min-h-0 pc:flex-col">
          <div className="pc:min-h-0 pc:flex-1">
            <PolicyNewsEmbed src={POLICY_NEWS_URL} />
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
