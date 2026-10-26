/** /inbox — 비서 사서함 (belie 2026-10-26). */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import InboxList from "@/components/inbox/InboxList";

export const metadata = { title: "비서 사서함" };

export default function InboxPage() {
  return <>
    <TopHeader pageEmoji="📮" pageTitle="비서 사서함" pageSubtitle="아침·저녁 요약" />
    <section className="px-4">
      <PageContainer width="narrow">
        <InboxList />
      </PageContainer>
    </section>
  </>;
}
