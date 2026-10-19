// C 승인 화면: 실제 재무 컴포넌트와 읽기 전용 합성 API만 사용한다.
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardFinance from "@/components/dashboard/DashboardFinance";
import { useDashboard } from "@/query/dashboard-hooks";
import "./dashboard-channel-profit-scenario";

// 외부 서비스로 이동하지 않고 합성 서버의 목적지로만 이동한다.
Object.assign(window, { __fixtureNavigate: (path: string) => location.assign(path) });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
function Fixture() {
  const dash = useDashboard();
  const [mount, setMount] = React.useState(0);
  return <main className="desktop-shell app-shell-main p-3">
    <button className="mb-2 text-xs" onClick={() => setMount(mount + 1)}>화면 다시 열기</button>
    <DashboardFinance key={mount} contractChannels={dash.data?.contractChannels} onRefreshChannels={dash.refetch}
      channelsRefreshing={dash.isFetching} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
