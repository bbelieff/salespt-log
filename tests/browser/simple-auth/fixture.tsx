/**
 * 간편인증 서류 조회 목업(2026-11-08) — PC 업무도구 「간편인증 서류 조회」 본문.
 * 실제 앱 CSS·컴포넌트 + 합성 상태. 제공사·서버 호출 없음. 위쪽 회색 띠는 목업 조작용(제품에 없음).
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShieldCheck } from "lucide-react";
import RequestForm, { type RequestInput } from "./RequestForm";
import RequestList from "./RequestList";
import DocBox from "./DocBox";
import { WAIT_LIMIT_MS, maskName, maskPhone, nextId, resultFor, seedRequests, type AuthRequest, type DocKey } from "./data";

type Scenario = "normal" | "partial" | "noApprove" | "empty";
const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "normal", label: "정상 — 8초 뒤 고객 승인" },
  { key: "partial", label: "일부 실패 — 재무제표 실패" },
  { key: "noApprove", label: "승인 안 함 — 시간 초과" },
  { key: "empty", label: "빈 목록" },
];
const stamp = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function App() {
  const [now, setNow] = useState(() => Date.now());
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [items, setItems] = useState<AuthRequest[]>(() => seedRequests(Date.now()));
  const [selectedId, setSelectedId] = useState<string | null>("req-2");
  const [toast, setToast] = useState("");
  const [approveAt, setApproveAt] = useState<Record<string, number>>({});

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); }, [toast]);

  // 상태 진행: 승인 감지 → 서류 하나씩 도착 → 완료 / 마감 지나면 시간 초과.
  useEffect(() => {
    setItems(list => {
      let changed = false;
      const next = list.map(r => {
        if (r.status === "waiting") {
          if (now >= r.deadline) { changed = true; return { ...r, status: "expired" as const }; }
          const at = approveAt[r.id];
          if (at !== undefined && now >= at) { changed = true; return { ...r, status: "scraping" as const }; }
        }
        if (r.status === "scraping") {
          const due = (approveAt[r.id] ?? now) + (r.results.length + 1) * 1200;
          if (now >= due) {
            changed = true;
            const key = r.docs[r.results.length];
            if (key === undefined) return r;
            const results = [...r.results, resultFor(key, scenario === "partial" && key === "fs")];
            if (results.length === r.docs.length) { setToast(`${r.company} 서류 ${results.filter(x => x.ok).length}건 도착`); return { ...r, results, status: "done" as const }; }
            return { ...r, results };
          }
        }
        return r;
      });
      return changed ? next : list;
    });
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickScenario(s: Scenario) {
    setScenario(s); setApproveAt({});
    if (s === "empty") { setItems([]); setSelectedId(null); } else { setItems(seedRequests(Date.now())); setSelectedId("req-2"); }
  }
  function send(v: RequestInput) {
    const id = nextId(), t = Date.now();
    setItems(l => [{ id, company: v.company, owner: maskName(v.owner), phone: maskPhone(v.phone), method: v.method, docs: v.docs, status: "waiting", sentAt: stamp(), deadline: t + WAIT_LIMIT_MS, resends: 0, results: [] }, ...l]);
    if (scenario !== "noApprove") setApproveAt(a => ({ ...a, [id]: t + 8000 }));
    setToast(`${v.company} 대표 휴대폰으로 ${v.method} 인증을 보냈어요`);
  }
  const approved = (id: string) => setApproveAt(a => ({ ...a, [id]: Date.now() }));
  function resend(id: string) {
    const t = Date.now();
    setItems(l => l.map(r => (r.id === id ? { ...r, status: "waiting", deadline: t + WAIT_LIMIT_MS, resends: r.resends + 1, results: [] } : r)));
    if (scenario !== "noApprove") setApproveAt(a => ({ ...a, [id]: t + 8000 }));
    setToast("인증을 다시 보냈어요");
  }
  const cancel = (id: string) => setItems(l => l.map(r => (r.id === id ? { ...r, status: "canceled" } : r)));
  function retryDoc(id: string, key: DocKey) {
    setItems(l => l.map(r => (r.id === id ? { ...r, results: r.results.map(x => (x.key === key ? resultFor(key) : x)) } : r)));
    setToast("다시 받으려면 고객 승인이 한 번 더 필요해요 (목업: 바로 성공 처리)");
  }
  const skipTime = () => setItems(l => l.map(r => (r.status === "waiting" ? { ...r, deadline: Date.now() + 5000 } : r)));
  const selected = items.find(r => r.id === selectedId && r.status === "done") ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-gray-400 bg-gray-200 px-4 py-2 text-xs text-gray-700" role="region" aria-label="목업 조작">
        <b>목업 조작(제품에 없음)</b>
        <select value={scenario} onChange={e => pickScenario(e.target.value as Scenario)} aria-label="합성 시나리오" className="rounded border border-gray-400 bg-white px-1.5 py-0.5">
          {SCENARIOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" onClick={skipTime} className="rounded border border-gray-400 bg-white px-2 py-0.5 hover:bg-gray-50">대기 시간 5초 남기기</button>
      </div>

      <header className="mx-auto max-w-6xl px-4 pt-6 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900"><ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden />간편인증 서류 조회</h1>
        <p className="mt-1 text-sm text-gray-600">대표 휴대폰으로 간편인증을 보내면, 고객이 승인하는 대로 홈택스 증명서를 받아 업체별 서류함에 모아요.</p>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-10 pc:flex-row pc:items-start">
        <div className="pc:w-96 pc:shrink-0"><RequestForm onSend={send} busy={false} /></div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <RequestList items={items} now={now} selectedId={selected?.id ?? null} onSelect={setSelectedId} onApproved={approved} onResend={resend} onCancel={cancel} />
          {selected && <DocBox key={selected.id} req={selected} onClose={() => setSelectedId(null)} onRetry={retryDoc} onApplied={n => setToast(`업체정보 ${n}칸을 바꿨어요 (목업: 저장 안 함)`)} />}
        </div>
      </main>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
        {toast && <p className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</p>}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
