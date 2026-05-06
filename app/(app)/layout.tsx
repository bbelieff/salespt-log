/**
 * (app) route group — 로그인 후 5탭 셸.
 *
 * 모든 (app)/* 페이지는 자동으로 하단 TabBar 를 갖는다.
 * content-area 패딩은 TabBar(76px) 와 겹치지 않도록 76px.
 *
 * 페이지 배경: bg-slate-100 (#f1f5f9)
 *   - 흰 카드(bg-white)와 명도 차이를 넓혀 리소스가 명확히 분리되어 보이도록.
 *   - slate 팔레트 유지로 채널 4색·강조색과의 일관성 보존.
 *   - 이전 bg-slate-50(#f8fafc)은 흰 카드와 너무 비슷해 카드가 떠보이지 않음.
 */
import TabBar from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-100">
      <main className="pb-[76px]">{children}</main>
      <TabBar />
    </div>
  );
}
