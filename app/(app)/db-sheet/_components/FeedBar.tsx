/**
 * 연결한 DB 시트 줄(2026-11-06 belie) — DB관리시트 표 위. 시트마다 마지막 확인·새 DB·확인 대기와
 * 지금 확인·끄기/켜기·해제. 07~21시 매시간 자동으로 새 DB만 들어온다.
 */
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { FeedAction, FeedView } from './feed-client';

const hhmm = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(iso));

export function FeedBar({ feeds, message, onDismiss, onAct, onReview, readOnly }: { feeds: FeedView[]; message: { text:string; error?:boolean }|null; onDismiss: () => void; onAct: (body: FeedAction) => Promise<{ result?: { added:number; review:number } }>; onReview: (feed: FeedView) => void; readOnly?: boolean }) {
  const [busy, setBusy] = useState(''), [note, setNote] = useState<{ text:string; error?:boolean }|null>(null);
  if (!feeds.length && !message) return null;
  async function run(id: string, body: FeedAction, done?: (out: { result?: { added:number; review:number } }) => string) {
    setBusy(id); setNote(null);
    try { const out = await onAct(body); if (done) setNote({ text: done(out) }); }
    catch (e) { setNote({ text: (e as Error).message, error: true }); }
    finally { setBusy(''); }
  }
  const shown = note ?? message;
  return <section className="sheet-feed-bar" aria-label="연결한 DB 시트">
    {feeds.map(f => <div className="sheet-feed-row" key={f.id} data-off={f.enabled ? undefined : ''}>
      <span className="sheet-feed-name"><Link2 size={14} aria-hidden="true"/><a href={f.sheetUrl} target="_blank" rel="noreferrer">{f.supplier} 시트</a></span>
      <span className="sheet-feed-state">{f.enabled ? '07~21시 매시간 확인' : f.lastError ? '멈춤 · 시트를 열 수 없어요' : '꺼짐'}{f.lastCheckedAt && ` · 마지막 ${hhmm(f.lastCheckedAt)}`}{f.enabled && f.lastAdded > 0 && ` · 새 DB ${f.lastAdded}건`}</span>
      {f.enabled && f.lastError && <span className="sheet-feed-warn" title={f.lastError}>지난 확인 실패</span>}
      {f.reviewCount > 0 && <button type="button" className="sheet-feed-review" onClick={() => onReview(f)}>확인 대기 {f.reviewCount}건</button>}
      {!readOnly && <span className="sheet-feed-actions">
        <button type="button" className="sheet-btn" disabled={!!busy} onClick={() => void run(f.id, { action:'check', id:f.id }, out => out.result?.added ? `새 DB ${out.result.added}건을 넣었어요.` : '새 DB가 없어요.')}>{busy === f.id ? '확인 중…' : '지금 확인'}</button>
        <button type="button" className="sheet-btn" disabled={!!busy} onClick={() => void run(f.id, { action:'enable', id:f.id, enabled:!f.enabled })}>{f.enabled ? '끄기' : '다시 켜기'}</button>
        <button type="button" className="sheet-text-btn" disabled={!!busy} onClick={() => void run(f.id, { action:'remove', id:f.id }, () => `${f.supplier} 시트 연결을 해제했어요. 이미 들어온 DB는 그대로예요.`)}>연결 해제</button>
      </span>}
    </div>)}
    {shown && <p className={`sheet-feed-message${shown.error ? ' is-error' : ''}`} role="status">{shown.text}<button type="button" className="sheet-text-btn" onClick={() => { setNote(null); onDismiss(); }}>닫기</button></p>}
  </section>;
}
