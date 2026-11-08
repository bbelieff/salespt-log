/**
 * 간편인증 서류 조회 목업 본문(2026-11-08). 실제 앱 CSS·컴포넌트 + 합성 상태. 제공사·서버 호출 없음.
 * 흐름: 인증 보내기(업체 선택 없음) → 고객 승인 → 서류 종류별 도착 → 사업자별 DB 연결 → 업체정보 반영.
 * live=true 면 실제 앱 셸(사이드바·TopHeader·PageContainer) 안에 들어가고, 목업 조작판은 오른쪽 아래에 뜬다.
 */
import React, { useEffect, useState } from "react";
import RequestForm, { type RequestInput } from "./RequestForm";
import RequestList from "./RequestList";
import DocBox from "./DocBox";
import { NEW_BIZES, WAIT_LIMIT_MS, makeBizes, nextId, resultFor, seedRequests, type AuthRequest, type DocKey, type Link } from "./data";

type Scenario = "normal" | "partial" | "noApprove" | "empty";
const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "normal", label: "정상 — 8초 뒤 고객 승인" },
  { key: "partial", label: "일부 실패 — 재무제표 당기분 없음" },
  { key: "noApprove", label: "승인 안 함 — 시간 초과" },
  { key: "empty", label: "빈 목록" },
];
const stamp = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
type Sel = { reqId: string; bizNo: string };
const DEFAULT_SEL: Sel = { reqId: "req-2", bizNo: "312-81-55210" };

export default function SimpleAuthMock({ live = false }: { live?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [items, setItems] = useState<AuthRequest[]>(() => seedRequests(Date.now()));
  const [sel, setSel] = useState<Sel | null>(DEFAULT_SEL);
  const [toast, setToast] = useState("");
  const [approveAt, setApproveAt] = useState<Record<string, number>>({});

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); }, [toast]);

  // 상태 진행: 승인 감지 → 서류 종류가 하나씩 도착 → 끝나면 사업자별로 펼치고 DB 연결.
  useEffect(() => {
    const done: string[] = [];
    setItems(list => {
      let changed = false;
      const next = list.map(r => {
        const at = approveAt[r.id];
        if (r.status === "waiting") {
          if (now >= r.deadline) { changed = true; return { ...r, status: "expired" as const }; }
          if (at !== undefined && now >= at) { changed = true; return { ...r, status: "scraping" as const, progress: 0 }; }
        }
        if (r.status === "scraping" && now >= (at ?? now) + (r.progress + 1) * 1200) {
          changed = true;
          const progress = r.progress + 1;
          if (progress < r.docs.length) return { ...r, progress };
          done.push(`${r.owner} 대표 · 사업자 ${NEW_BIZES.length}곳 서류 도착`);
          const businesses = makeBizes(NEW_BIZES, r.docs, r.phone, scenario === "partial" ? "fs" : undefined);
          return { ...r, progress, status: "done" as const, businesses };
        }
        return r;
      });
      return changed ? next : list;
    });
    if (done.length) setToast(done[0] ?? "");
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickScenario(s: Scenario) {
    setScenario(s); setApproveAt({});
    if (s === "empty") { setItems([]); setSel(null); } else { setItems(seedRequests(Date.now())); setSel(DEFAULT_SEL); }
  }
  function send(v: RequestInput) {
    const id = nextId(), t = Date.now();
    setItems(l => [{ id, owner: v.owner, phone: v.phone, method: v.method, docs: v.docs, status: "waiting", sentAt: stamp(), deadline: t + WAIT_LIMIT_MS, resends: 0, progress: 0, businesses: [] }, ...l]);
    if (scenario !== "noApprove") setApproveAt(a => ({ ...a, [id]: t + 8000 }));
    setToast(`대표 휴대폰으로 ${v.method} 인증을 보냈어요`);
  }
  const approved = (id: string) => setApproveAt(a => ({ ...a, [id]: Date.now() }));
  function resend(id: string) {
    const t = Date.now();
    setItems(l => l.map(r => (r.id === id ? { ...r, status: "waiting", deadline: t + WAIT_LIMIT_MS, resends: r.resends + 1, progress: 0, businesses: [] } : r)));
    if (scenario !== "noApprove") setApproveAt(a => ({ ...a, [id]: t + 8000 }));
    setToast("인증을 다시 보냈어요");
  }
  const cancel = (id: string) => setItems(l => l.map(r => (r.id === id ? { ...r, status: "canceled" } : r)));
  const remove = (id: string) => { setItems(l => l.filter(r => r.id !== id)); setToast("기록을 삭제했어요"); };
  const patchBiz = (s: Sel, f: (b: AuthRequest["businesses"][number]) => AuthRequest["businesses"][number]) =>
    setItems(l => l.map(r => (r.id === s.reqId ? { ...r, businesses: r.businesses.map(b => (b.bizNo === s.bizNo ? f(b) : b)) } : r)));
  function applied(n: number) {
    if (!sel) return;
    patchBiz(sel, b => ({ ...b, applied: true }));
    setSel(null);
    setToast(`업체정보 ${n}칸 반영 — 목록에서 뺐어요 (목업: 저장 안 함)`);
  }
  function retryDoc(key: DocKey) {
    if (!sel) return;
    patchBiz(sel, b => ({ ...b, results: b.results.map(x => (x.key === key ? resultFor(key) : x)) }));
    setToast("다시 받으려면 고객 승인이 한 번 더 필요해요 (목업: 바로 성공 처리)");
  }
  function link(l: Link) {
    if (!sel) return;
    patchBiz(sel, b => ({ ...b, link: l }));
    if (l.state === "linked") setToast("DB에 연결했어요");
    if (l.state === "created") setToast("새 DB로 만들었어요 (목업: 저장 안 함)");
  }
  const skipTime = () => setItems(l => l.map(r => (r.status === "waiting" ? { ...r, deadline: Date.now() + 5000 } : r)));
  const selReq = sel ? items.find(r => r.id === sel.reqId && r.status === "done") : undefined;
  const selBiz = selReq?.businesses.find(b => b.bizNo === sel?.bizNo);

  const controls = (
    <div role="region" aria-label="목업 조작" className={`flex flex-wrap items-center gap-2 text-xs text-gray-700 ${live ? "fixed bottom-4 right-4 z-50 rounded-lg border border-dashed border-gray-400 bg-gray-100/95 px-3 py-2 shadow-md" : "border-b border-dashed border-gray-400 bg-gray-200 px-4 py-2"}`}>
      <b>목업 조작(제품에 없음)</b>
      <select value={scenario} onChange={e => pickScenario(e.target.value as Scenario)} aria-label="합성 시나리오" className="rounded border border-gray-400 bg-white px-1.5 py-0.5">
        {SCENARIOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <button type="button" onClick={skipTime} className="rounded border border-gray-400 bg-white px-2 py-0.5 hover:bg-gray-50">대기 5초 남기기</button>
    </div>
  );
  const body = (
    <div className="flex flex-col gap-4 pc:flex-row pc:items-start">
      <div className="pc:w-96 pc:shrink-0"><RequestForm onSend={send} busy={false} /></div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <RequestList items={items} now={now} selected={selBiz ? sel : null} onSelect={(reqId, bizNo) => setSel({ reqId, bizNo })} onApproved={approved} onResend={resend} onCancel={cancel} onDelete={remove} />
        {selReq && selBiz && <DocBox key={`${selReq.id}:${selBiz.bizNo}`} req={selReq} biz={selBiz} onClose={() => setSel(null)} onRetry={retryDoc} onLink={link} onApplied={applied} />}
      </div>
    </div>
  );
  const toastEl = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
      {toast && <p className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</p>}
    </div>
  );
  if (live) return <>{body}{controls}{toastEl}</>;
  return (
    <div className="min-h-screen bg-gray-50">
      {controls}
      <header className="mx-auto max-w-6xl px-4 pb-4 pt-6"><h1 className="text-xl font-bold text-gray-900">간편인증 서류 조회</h1></header>
      <main className="mx-auto max-w-6xl px-4 pb-10">{body}</main>
      {toastEl}
    </div>
  );
}
