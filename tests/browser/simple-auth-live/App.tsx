/**
 * 간편인증 서류 조회 — 라이브 셸 목업(2026-11-08). 실제 DesktopNav·TopHeader·PageContainer·글꼴 안에 본문을 넣는다.
 * server.mjs 가 /api 를 가상 값으로 답하고, 사이드바 업무도구에 「간편인증 서류 조회」 행을 목업에서만 끼워 넣는다.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DirtyProvider from "@/components/DirtyGuard";
import DesktopNav from "@/components/desktop/DesktopNav";
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import SimpleAuthMock from "../simple-auth/SimpleAuthMock";

history.replaceState({}, "", "/work-tools/simple-auth");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <DirtyProvider>
      <div className="desktop-shell pc:flex">
        <DesktopNav />
        <div className="min-w-0 pc:flex-1">
          <main className="app-shell-main">
            <TopHeader pageEmoji="🔐" pageTitle="간편인증 서류 조회" />
            <section className="px-4 pb-10">
              <PageContainer width="fluid">
                <SimpleAuthMock live />
              </PageContainer>
            </section>
          </main>
        </div>
      </div>
    </DirtyProvider>
  </QueryClientProvider>,
);
