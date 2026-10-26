/** /inbox/[id] — 하루요약 한 건 (belie 2026-10-26). */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import DailyReportView from "@/components/inbox/DailyReportView";

export const metadata = { title: "하루요약" };

export default async function InboxReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <>
    <TopHeader pageEmoji="📮" pageTitle="비서 사서함" pageSubtitle="하루요약" />
    <section className="px-4">
      <PageContainer width="narrow">
        <DailyReportView id={id} />
      </PageContainer>
    </section>
  </>;
}
