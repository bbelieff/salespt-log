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

export default function SimpleAuthMock({ live = false }: { live?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [items, setItems] = useState<AuthRequest[]>(() => seedRequests(Date.now()));
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
    setItems(s === "empty" ? [] : seedRequests(Date.now()));
  }
  function send(v: RequestInput) {
    const id = nextId(), t = Date.now();
    // 공동인증서는 고객 승인이 없어 바로 「받는 중」으로 간다.
    const cert = v.method === "공동인증서";
    setItems(l => [{ id, owner: v.owner, phone: v.phone, method: v.method, docs: v.docs, status: cert ? "scraping" : "waiting", sentAt: stamp(), deadline: t + WAIT_LIMIT_MS, resends: 0, progress: 0, businesses: [] }, ...l]);
    if (cert || scenario !== "noApprove") setApproveAt(a => ({ ...a, [id]: cert ? t : t + 8000 }));
    setToast(cert ? `${v.certKind ?? ""} 공동인증서로 ${v.owner} 대표 서류를 가져오고 있어요` : `대표 휴대폰으로 ${v.method} 인증을 보냈어요`);
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
  // 펼침 상태는 RequestList 가 업체마다 따로 기억한다 — 여기서는 어느 업체에 대한 동작인지만 받는다.
  function applied(sel: Sel, n: number) {
    patchBiz(sel, b => ({ ...b, applied: true }));
    setToast(`업체정보 ${n}칸 반영 — 목록에서 뺐어요 (목업: 저장 안 함)`);
  }
  function retryDoc(sel: Sel, key: DocKey) {
    patchBiz(sel, b => ({ ...b, results: b.results.map(x => (x.key === key ? resultFor(key) : x)) }));
    setToast("다시 받으려면 고객 승인이 한 번 더 필요해요 (목업: 바로 성공 처리)");
  }
  function link(sel: Sel, l: Link) {
    patchBiz(sel, b => ({ ...b, link: l }));
    if (l.state === "linked") setToast("DB에 연결했어요");
    if (l.state === "created") setToast("새 DB로 만들었어요 (목업: 저장 안 함)");
  }
  const skipTime = () => setItems(l => l.map(r => (r.status === "waiting" ? { ...r, deadline: Date.now() + 5000 } : r)));

  const controls = (
    <div role="region" aria-label="목업 조작" className={`flex flex-wrap items-center gap-2 text-xs text-slate-700 ${live ? "fixed bottom-4 right-4 z-50 rounded-lg border border-dashed border-slate-400 bg-slate-100/95 px-3 py-2 shadow-md" : "border-b border-dashed border-slate-400 bg-slate-200 px-4 py-2"}`}>
      <b>목업 조작(제품에 없음)</b>
      <select value={scenario} onChange={e => pickScenario(e.target.value as Scenario)} aria-label="합성 시나리오" className="rounded border border-slate-400 bg-white px-1.5 py-0.5">
        {SCENARIOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <button type="button" onClick={skipTime} className="rounded border border-slate-400 bg-white px-2 py-0.5 hover:bg-slate-50">대기 5초 남기기</button>
    </div>
  );
  // 2단(belie 2026-11-09): ① 보내기·가져오기 | ② 보낸 인증. 받은 서류·DB 연결·업체정보 반영은 ② 의 업체 바로 밑에 펼친다.
  const detail = (reqId: string, bizNo: string) => {
    const req = items.find(r => r.id === reqId && r.status === "done");
    const biz = req?.businesses.find(b => b.bizNo === bizNo);
    if (!req || !biz) return null;
    const t = { reqId, bizNo };
    return <DocBox key={`${reqId}:${bizNo}`} inline req={req} biz={biz} onClose={() => undefined} onRetry={k => retryDoc(t, k)} onLink={l => link(t, l)} onApplied={n => applied(t, n)} />;
  };
  const body = (
    <div className="flex flex-col gap-4 pc:flex-row pc:items-start">
      <div className="pc:w-96 pc:shrink-0 wide:w-1/3">
        <RequestForm onSend={send} busy={false} />
      </div>
      <div className="min-w-0 flex-1">
        <RequestList items={items} now={now} detail={detail} onApproved={approved} onResend={resend} onCancel={cancel} onDelete={remove} />
      </div>
    </div>
  );
  const toastEl = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
      {toast && <p className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</p>}
    </div>
  );
  if (live) return <>{body}{controls}{toastEl}</>;
  return (
    <div className="min-h-screen bg-slate-50">
      {controls}
      <header className="mx-auto max-w-6xl px-4 pb-4 pt-6"><h1 className="text-xl font-bold text-slate-900">간편인증 서류 조회</h1></header>
      <main className="mx-auto max-w-6xl px-4 pb-10">{body}</main>
      {toastEl}
    </div>
  );
}
