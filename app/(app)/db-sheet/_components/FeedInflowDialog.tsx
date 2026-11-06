/**
 * 연결한 시트에서 자동으로 들어온 DB의 유입 반영 묻기(2026-11-06 belie 「자동 수집 후 팝업으로 반영할지 선택」).
 * 들어올 때는 유입 「반영 안 함」으로 들어오고, 여기서 고른 DB만 STEP 2 유입 실적에 넣는다.
 * 「반영」·「반영 안 함」 모두 답한 것으로 보고 다시 묻지 않는다(줄마다 유입 칸에서 언제든 바꿀 수 있다).
 */
import { useState } from 'react';
import { Inbox } from 'lucide-react';
import SheetDialog from './SheetDialog';
import type { Row } from './model';

export function FeedInflowDialog({ rows, onReflect, onAnswer, onLater }: { rows: Row[]; onReflect: (ids: string[]) => Promise<void>; onAnswer: (ids: string[]) => Promise<void>; onLater: () => void }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(rows.map(r => r.id))), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const all = rows.map(r => r.id);
  async function finish(reflect: boolean) {
    setBusy(true); setError('');
    try { if (reflect && picked.size) await onReflect([...picked]); await onAnswer(all); }
    catch (e) { setError((e as Error).message || '반영하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  const toggle = (id: string) => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <SheetDialog title="새로 들어온 DB" icon={<Inbox size={18}/>} onClose={() => { if (!busy) onLater(); }}>
    <div className="sheet-feed-inflow">
      <p>연결한 시트에서 <b>{rows.length}건</b>이 들어왔어요. STEP 2 유입으로 반영할 DB를 골라 주세요.</p>
      {error && <p role="alert" className="sheet-feed-message is-error">{error}</p>}
      <label className="sheet-feed-pick sheet-feed-pick-all"><input type="checkbox" checked={picked.size === rows.length} ref={el => { if (el) el.indeterminate = picked.size > 0 && picked.size < rows.length; }} onChange={e => setPicked(new Set(e.target.checked ? all : []))}/>전체 선택</label>
      <ul>{rows.map(r => <li key={r.id}><label className="sheet-feed-pick"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)}/><span className="sheet-feed-pick-name">{r.company || r.owner}</span><span className="sheet-feed-pick-meta">{r.supplier} · {r.date}</span></label></li>)}</ul>
      <div className="sheet-feed-inflow-actions">
        <button type="button" className="sheet-text-btn" disabled={busy} onClick={onLater}>나중에</button>
        <button type="button" className="sheet-btn" disabled={busy} onClick={() => void finish(false)}>반영 안 함</button>
        <button type="button" className="sheet-btn primary" disabled={busy || !picked.size} onClick={() => void finish(true)}>{busy ? '반영 중…' : `${picked.size}건 반영`}</button>
      </div>
    </div>
  </SheetDialog>;
}
