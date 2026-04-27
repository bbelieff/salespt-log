/**
 * (app) route group — 로그인 후 5탭 셸.
 *
 * 모든 (app)/* 페이지는 자동으로 하단 TabBar 를 갖는다.
 * content-area 패딩은 TabBar(76px) 와 겹치지 않도록 76px.
 */
import TabBar from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <main className="pb-[76px]">{children}</main>
      <TabBar />
    </div>
  );
}
