/** /settings/notifications — 알림 설정 (web-push-notifications §2-2 4번). */
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import NotificationSettings from "@/components/push/NotificationSettings";

export const metadata = { title: "알림 설정" };

export default function NotificationSettingsPage() {
  return <>
    <TopHeader pageEmoji="🔔" pageTitle="알림 설정" pageSubtitle="시간·요일" />
    <section className="px-4">
      <PageContainer width="narrow">
        <NotificationSettings />
      </PageContainer>
    </section>
  </>;
}
