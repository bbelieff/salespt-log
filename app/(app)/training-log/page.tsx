/** /training-log — 내 트레이닝일지 (belie 2026-10-30). 노션 기수 페이지 대신 자기 일지만. */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import TrainingLogList from "@/components/training-log/TrainingLogList";

export const metadata = { title: "트레이닝일지" };

export default function TrainingLogPage() {
  return <>
    <TopHeader pageEmoji="📒" pageTitle="트레이닝일지" pageSubtitle="1:1 트레이닝 기록" />
    <section className="px-4">
      <PageContainer width="narrow">
        <TrainingLogList />
      </PageContainer>
    </section>
  </>;
}
