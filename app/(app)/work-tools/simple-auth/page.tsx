import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import SimpleAuthPanel from "@/components/simple-auth/SimpleAuthPanel";

export const metadata = { title: "간편인증 서류 조회" };

/** 업무도구 — 간편인증 서류 조회(docs/plans/active/simple-auth-scraping.md). 로그인은 middleware, 권한은 API 가 본다. */
export default function SimpleAuthPage() {
  return (
    <>
      <TopHeader pageEmoji="🔐" pageTitle="간편인증 서류 조회" />
      <section className="px-4">
        <PageContainer width="fluid">
          <SimpleAuthPanel />
        </PageContainer>
      </section>
    </>
  );
}
