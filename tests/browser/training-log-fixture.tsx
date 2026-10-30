// 트레이닝일지 화면 확인용 — 실제 컴포넌트·CSS + 합성 응답(노션·로그인 없음). 이름·내용은 전부 가상.
//   /            목록    /?empty=1  일지 없음    /?status=not_configured  연결 전
//   /training-log/<id>  본문(긴 제목·표·토글·형광펜)
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TrainingLogList from "@/components/training-log/TrainingLogList";
import TrainingLogView from "@/components/training-log/TrainingLogView";
import type { LogBlock, TrainingLogItem } from "@/types/training-log";

const q = new URLSearchParams(location.search);
const items: TrainingLogItem[] = Array.from({ length: 7 }, (_, i) => ({
  id: `aaaaaaaa-0000-0000-0000-00000000000${7 - i}`,
  title: i === 0 ? "가상일 대표님 7주차 트레이닝 일지 — 제목이 아주 길어서 한 줄을 넘어가는 경우를 확인하는 가상 제목" : `가상일 대표님 ${7 - i}주차 트레이닝 일지`,
  week: 7 - i, createdTime: "2026-10-01T00:00:00Z",
}));
const t = (text: string, extra = {}) => [{ text, ...extra }];
const blocks: LogBlock[] = [
  { type: "toggle", text: t("지난주 트레이닝 복습"), children: [
    { type: "h1", text: t("💼 3주차 진행") },
    { type: "h2", text: t("📌 지난주 PT 복기", { bold: true }) },
    { type: "ul", text: t("주안점 및 과제 상기") },
    { type: "ul", text: t("과제 시트 열기", { href: "https://example.com" }) },
  ] },
  { type: "h2", text: t("🧪 공문테스트") },
  { type: "p", text: [{ text: "소진공 업력 90일, 제조·건설 " }, { text: "10인 미만", highlight: true, bold: true }, { text: " 그외 업종 5인 미만" }] },
  { type: "ul", text: t("혁신성장촉진자금", { bold: true }), children: [
    { type: "ul", text: t("혁신형: 수출, 2년 연속 매출 신장 10%") },
    { type: "ul", text: t("일반형: 스마트장비·자동화 설비") },
  ] },
  { type: "ol", text: t("가상 첫째") }, { type: "ol", text: t("가상 둘째") },
  { type: "divider", text: [] },
  { type: "h1", text: t("🤠 트레이너 피드백") },
  { type: "callout", text: t("고객에게 신청하게 하는 자료 만들기 — 직원교육용") },
  { type: "todo", text: t("후기 1000자 이상"), checked: true },
  { type: "todo", text: t("댓글 3명 이상 달기"), checked: false },
  { type: "table", text: [], rows: [[t("시간"), t("1set"), t("2set"), t("3set")], [t("10시"), t(""), t("가상일 → 가상트, 가상이"), t("")], [t("11시30분"), t("가상삼"), t("가상사"), t("가상오")]] },
  { type: "file", text: t("진행기관_포함_상담일지.zip"), url: "https://example.com/file.zip" },
  { type: "quote", text: t("더 나은 한주를 위해") },
];

window.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  await new Promise((r) => setTimeout(r, 200));
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/api/training-log")) {
    const status = q.get("status");
    if (status) return ok({ status, items: [] });
    return ok({ status: "ok", items: q.get("empty") ? [] : items });
  }
  const id = decodeURIComponent(url.split("/").pop() ?? "");
  const item = items.find((i) => i.id === id);
  return item ? ok({ ...item, blocks }) : ok({ error: "not_found" }, 404);
}) as typeof fetch;

(window as unknown as { __fixtureNavigate: (p: string) => void }).__fixtureNavigate = (p) => { history.pushState(null, "", p); render(); };
addEventListener("popstate", () => render());

const client = new QueryClient();
const root = createRoot(document.getElementById("root")!);
function render() {
  const m = location.pathname.match(/^\/training-log\/(.+)$/);
  root.render(<QueryClientProvider client={client}>
    <main className="mx-auto w-full max-w-2xl px-4">{m ? <TrainingLogView id={m[1]!} /> : <TrainingLogList />}</main>
  </QueryClientProvider>);
}
render();
