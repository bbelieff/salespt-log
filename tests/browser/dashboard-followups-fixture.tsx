/**
 * 대시보드 「오늘 챙길 일」 목업 — 실제 화면 컴포넌트 + 합성 API(dashboard-followups-server.mjs).
 * 주소(pathname)로 실제 페이지를 고른다: / · /dashboard → DashboardPage, /payment → PaymentPage,
 * /schedule → SchedulePage, /db-sheet → DbSheetPage. 링크·router.push 는 history.pushState 로 옮겨
 * Next 의 클라이언트 이동처럼 QueryClient 캐시를 유지한다(대시보드 → 도착 화면 → 뒤로).
 * 시나리오는 쿠키 followups_scenario 로 서버에 전한다(이동해도 유지): ?scenario=some|many|empty|error|unsupported,
 * 줄임 ?empty=1 ?many=1 ?error=1 ?unsupported=1, 보조 조회 지연 ?slow=1.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "../../app/(app)/dashboard/page";
import PaymentPage from "../../app/(app)/payment/page";
import SchedulePage from "../../app/(app)/schedule/page";
import DbSheetPage from "../../app/(app)/db-sheet/page";
import WeeklyGoalSummary from "../../components/weekly-goals/WeeklyGoalSummary";
import DesktopNav from "../../components/desktop/DesktopNav";
import TabBar from "../../components/TabBar";
import DirtyProvider from "../../components/DirtyGuard";
import { LoadingProvider } from "../../components/ui/LoadingProvider";



const SCENARIOS = ["some", "many", "empty", "error", "unsupported"] as const;

/** 대시보드로 처음 들어올 때 주소의 시나리오를 쿠키에 적는다(없으면 기본 some). 다른 화면 직접 진입은 쿠키 유지. */
function syncScenarioCookie() {
  const params = new URLSearchParams(location.search);
  const onDashboard = location.pathname === "/" || location.pathname === "/dashboard";
  const named = params.get("scenario");
  const flag = SCENARIOS.find((s) => params.get(s) === "1");
  const scenario = SCENARIOS.find((s) => s === named) ?? flag;
  if (scenario || onDashboard) document.cookie = `followups_scenario=${scenario ?? "some"}; path=/`;
  if (params.has("slow") || onDashboard) document.cookie = `followups_slow=${params.get("slow") === "1" ? "1" : "0"}; path=/`;
}
syncScenarioCookie();
if(location.pathname === "/dashboard")document.cookie = `quality=${new URLSearchParams(location.search).get("quality") ?? ""}; path=/`;
// D mock-only, non-sensitive localhost fixture controls. Never used by production pages.
for(const [param,cookie] of [['paymentDelay','payment_delay'],['paymentFail','payment_fail'],['paymentManual','payment_manual']]){
 const value=new URLSearchParams(location.search).get(param!);
 if(value!==null)document.cookie=`${cookie}=${encodeURIComponent(value)}; path=/`;
}
const fixtureWeek = new URLSearchParams(location.search).get("week");
if (location.pathname === "/dashboard" || location.pathname === "/") {
  document.cookie = `followups_week=${fixtureWeek ?? "7"}; path=/`;
}

declare global {
  interface Window { __fixtureNavigate: (href: string, replace?: boolean) => void }
}
window.__fixtureNavigate = (href, replace = false) => {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin) { location.assign(href); return; }
  history[replace ? "replaceState" : "pushState"]({}, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event("fixture:navigate"));
  window.scrollTo(0, 0);
};

// 운영 providers.tsx 와 같은 기본값(30초 신선·창 포커스 재조회 없음·재시도 1회).
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 }, mutations: { retry: 0 } } });

const PAGES: Record<string, React.ComponentType> = {
  "/weekly-summary-check": () => <div className="p-4"><WeeklyGoalSummary /></div>,
  "/": DashboardPage,
  "/dashboard": DashboardPage,
  "/payment": PaymentPage,
  "/schedule": SchedulePage,
  "/db-sheet": DbSheetPage,

};

function Missing() {
  return (
    <main className="p-6 text-sm text-slate-600">
      이 합성 화면에는 <code>{location.pathname}</code> 페이지가 없어요.{" "}
      <a className="font-semibold text-blue-700" href="/dashboard" onClick={(e) => { e.preventDefault(); window.__fixtureNavigate("/dashboard"); }}>대시보드로</a>
    </main>
  );
}

function useLocationKey(): string {
  const [key, setKey] = React.useState(location.pathname + location.search);
  React.useEffect(() => {
    const sync = () => setKey(location.pathname + location.search);
    window.addEventListener("popstate", sync);
    window.addEventListener("fixture:navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("fixture:navigate", sync);
    };
  }, []);
  return key;
}

/** Same actual mutation cache on both sides; visible only after a synthetic request remains pending for 400ms. */
function PaymentPendingProbe(){
 const [pending,setPending]=React.useState(false),[long,setLong]=React.useState(false);
 const [failure,setFailure]=React.useState(()=>document.cookie.split('; ').some(c=>c==='payment_fail=1'));
 React.useEffect(()=>{const cache=client.getMutationCache();const sync=()=>setPending(cache.getAll().some(m=>m.state.status==='pending'));sync();return cache.subscribe(sync);},[]);
 React.useEffect(()=>{setLong(false);if(!pending)return;const timer=setTimeout(()=>setLong(true),400);return()=>clearTimeout(timer);},[pending]);
 return <aside style={{position:'fixed',bottom:4,right:4,zIndex:500,background:'white',border:'1px solid #94a3b8',padding:'3px 6px',fontSize:10}} aria-label="합성 저장 검증 도구">
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{const next=!failure;document.cookie=`payment_fail=${next?'1':'0'}; path=/`;setFailure(next);}}>합성 저장: {failure?'실패':'정상'} (전환)</button>
  {long&&<span data-fixture-mutation-pending> · 응답 대기 400ms+</span>}
 </aside>;
}
function Fixture() {
  const key = useLocationKey();
  const Page = PAGES[location.pathname] ?? Missing;
  return (
    <QueryClientProvider client={client}>
      {new URLSearchParams(location.search).has('paymentDelay')&&<PaymentPendingProbe/>}
      <LoadingProvider>
        <DirtyProvider>
          <div className="desktop-shell pc:flex"><DesktopNav />
            <div className="min-w-0 pc:flex-1"><main className="app-shell-main"><Page key={key} /></main></div>
            <TabBar />
          </div>
        </DirtyProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
