/** /training-log/[id] — 트레이닝일지 한 편 (belie 2026-10-30). 내 것이 아니면 서버가 404. */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import TrainingLogView from "@/components/training-log/TrainingLogView";

export const metadata = { title: "트레이닝일지" };

export default async function TrainingLogEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <>
    <TopHeader pageEmoji="📒" pageTitle="트레이닝일지" pageSubtitle="1:1 트레이닝 기록" />
    <section className="px-4">
      <PageContainer width="narrow">
        <TrainingLogView id={id} />
      </PageContainer>
    </section>
  </>;
}
