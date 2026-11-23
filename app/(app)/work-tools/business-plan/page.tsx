import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import BizplanTool from "@/components/bizplan/BizplanTool";

export const metadata = { title: "사업계획서 작성도구" };

/** 업무도구 — 사업계획서 작성도구(docs/plans/active/bizplan-tool.md, ADR-0039). 로그인은 middleware, 공식 빌더 권한은 API 가 본다. */
export default function BusinessPlanPage() {
  return (
    <>
      <TopHeader pageEmoji="📑" pageTitle="사업계획서 작성도구" />
      <section className="px-4">
        <PageContainer width="fluid">
          <BizplanTool />
        </PageContainer>
      </section>
    </>
  );
}
