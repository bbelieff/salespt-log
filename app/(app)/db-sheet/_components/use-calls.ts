"use client";
/**
 * 통화 정리 상태(plan call-summary PR-5a). GET /api/calls 가 404 면 이 사람에게 꺼진 기능 → 📞·칩을 그리지 않는다.
 * 정리 중인 통화가 있으면 4초마다 다시 읽고, 이 화면에서 올린 통화가 끝나면(확인 필요·실패) 알린다.
 * 📞 로 다른 앱에 다녀오면(화면이 다시 보이면) 「방금 통화하셨나요?」를 연다 — 📞 기록은 sessionStorage 에 잠깐 둔다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CallRecord } from "@/types/call";
import { fetchActiveCalls, latestCallByLead } from "./call-client";

export type DialedCall = { id: string; leadId: string; at: number };
const PENDING_KEY = "db-sheet-call-pending";
const POLL_MS = 4_000;

function readPending(): DialedCall | null {
  try { const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null"); return v?.id && v?.leadId ? v : null; } catch { return null; }
}

export function useCalls(nameOf: (leadId: string) => string) {
  const [enabled, setEnabled] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  /** open = 확인 화면으로 갈 업체(정리가 끝난 통화). */
  const [toast, setToast] = useState<{ text: string; open?: string } | null>(null);
  const [returned, setReturned] = useState<DialedCall | null>(null);
  const watched = useRef(new Set<string>());
  const name = useRef(nameOf); name.current = nameOf;

  const refresh = useCallback(async () => {
    const list = await fetchActiveCalls().catch(() => undefined);
    if (list === undefined) return; // 잠깐의 네트워크 오류 — 다음 차례에 다시
    if (list === null) { setEnabled(false); setCalls([]); return; }
    setEnabled(true);
    for (const c of list) {
      if (!watched.current.has(c.id)) continue;
      if (c.status === "review") { watched.current.delete(c.id); setToast({ text: `${name.current(c.leadId)} 정리가 끝났어요.`, open: c.leadId }); }
      if (c.status === "failed") { watched.current.delete(c.id); setToast({ text: `${name.current(c.leadId)} 정리 실패. ${c.error || "다시 올려 주세요."}` }); }
    }
    setCalls(list);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const working = calls.some(c => c.status === "queued" || c.status === "processing");
  useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [working, refresh]);

  // 📞 뒤 돌아오면 한 번만 묻는다. 새로고침으로 돌아와도(전화 앱이 탭을 다시 열 때) 묻는다.
  useEffect(() => {
    const ask = () => {
      const p = readPending();
      if (document.visibilityState !== "visible" || !p || Date.now() - p.at < 3_000) return;
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* 그대로 둬도 한 번 더 물을 뿐 */ }
      setReturned(p);
      void refresh();
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => document.removeEventListener("visibilitychange", ask);
  }, [refresh]);

  return {
    enabled, calls, toast, returned,
    latest: latestCallByLead(calls),
    clearToast: () => setToast(null),
    say: (text: string) => setToast({ text }),
    clearReturned: () => setReturned(null),
    refresh,
    /** 📞 를 눌러 서버에 기록한 직후 — 다른 앱에 다녀오면 녹음을 묻는다. */
    dialed(p: DialedCall) { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* 묻지 못하면 DB정보에서 올리면 된다 */ } void refresh(); },
    /** 녹음·글자를 올렸다 — 끝나면 알린다. */
    uploaded(id: string, leadId: string) { watched.current.add(id); setToast({ text: `${name.current(leadId)} 정리 중… 끝나면 알려 드려요.` }); void refresh(); },
  };
}
export type CallsState = ReturnType<typeof useCalls>;
