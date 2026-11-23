/**
 * 사업계획서 작성도구 — 라이브 셸 목업(2026-11-23). 실제 DesktopNav·TopHeader·PageContainer·글꼴 안에 실제 BizplanTool 을 넣는다.
 * server.mjs 가 /api 를 가상 값으로 답한다(공식 빌더 내용도 가상 글자).
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DirtyProvider from "@/components/DirtyGuard";
import DesktopNav from "@/components/desktop/DesktopNav";
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import BizplanTool from "@/components/bizplan/BizplanTool";

history.replaceState({}, "", "/work-tools/business-plan");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <DirtyProvider>
      <div className="desktop-shell pc:flex">
        <DesktopNav />
        <div className="min-w-0 pc:flex-1">
          <main className="app-shell-main">
            <TopHeader pageEmoji="📑" pageTitle="사업계획서 작성도구" />
            <section className="px-4">
              <PageContainer width="fluid">
                <BizplanTool />
              </PageContainer>
            </section>
          </main>
        </div>
      </div>
    </DirtyProvider>
  </QueryClientProvider>,
);
