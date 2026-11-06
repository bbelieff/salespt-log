/**
 * DB 시트 자동 확인 연결(2026-11-06 belie) — 화면 쪽 요청과 목록 훅.
 * 가져오기 창이 연결하면 'db-sheet-feeds-changed' 이벤트로 알려 목록·안내를 새로 읽는다.
 */
import { useCallback, useEffect, useState } from 'react';

export type FeedView = { id:string; supplier:string; channel:string; sheetUrl:string; enabled:boolean; lastCheckedAt:string|null; lastAdded:number; reviewCount:number; lastError:string|null; pendingInflow:string[] };
export type FeedAction = {action:'connect';url:string;supplier:string;channel:string;rules:Record<string,string>}|{action:'check';id:string}|{action:'enable';id:string;enabled:boolean}|{action:'remove';id:string}|{action:'answer';ids:string[]};
export const FEEDS_CHANGED = 'db-sheet-feeds-changed';

export async function feedRequest(body: FeedAction): Promise<{ feeds?: FeedView[]; result?: { added:number; review:number } }> {
  const res = await fetch('/api/db-sheet/feeds', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({})) as { error?: string; feeds?: FeedView[]; result?: { added:number; review:number } };
  if (!res.ok) throw new Error(data.error || '연결 정보를 바꾸지 못했어요.');
  return data;
}

/** 가져오기 창에서 「자동 확인」을 켜고 추가했을 때. 결과 안내는 이벤트로 연결 막대에 띄운다. */
export async function connectFeed(input: { url:string; supplier:string; channel:string; rules:Record<string,string> }) {
  try { await feedRequest({ action:'connect', ...input }); window.dispatchEvent(new CustomEvent(FEEDS_CHANGED, { detail:{ message:`${input.supplier} 시트를 연결했어요. 07~21시 매시간 새 DB만 들어와요.` } })); }
  catch (e) { window.dispatchEvent(new CustomEvent(FEEDS_CHANGED, { detail:{ message:`DB는 추가했지만 자동 확인은 연결하지 못했어요. ${(e as Error).message}`, error:true } })); }
}

export function useDbSheetFeeds() {
  const [feeds, setFeeds] = useState<FeedView[]>([]), [editable, setEditable] = useState(false), [message, setMessage] = useState<{ text:string; error?:boolean }|null>(null);
  const reload = useCallback(async () => {
    try { const res = await fetch('/api/db-sheet/feeds', { cache:'no-store' }); if (res.ok) { const body = (await res.json()) as { feeds?: FeedView[]; editable?: boolean }; setFeeds(body.feeds ?? []); setEditable(!!body.editable); } } catch { /* 연결 목록이 안 보여도 시트는 그대로 쓴다 */ }
  }, []);
  useEffect(() => {
    void reload();
    const on = (e: Event) => { const d = (e as CustomEvent<{ message?:string; error?:boolean }>).detail; if (d?.message) setMessage({ text:d.message, error:d.error }); void reload(); };
    window.addEventListener(FEEDS_CHANGED, on);
    return () => window.removeEventListener(FEEDS_CHANGED, on);
  }, [reload]);
  const act = useCallback(async (body: FeedAction) => { const out = await feedRequest(body); if (out.feeds) setFeeds(out.feeds); return out; }, []);
  return { feeds, editable, message, setMessage, reload, act };
}
