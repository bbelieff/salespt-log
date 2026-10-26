"use client";
/**
 * 휴지통(2026-10-26 belie 「삭제한 내용은 10초가 아니라 휴지통에서 가져와야 함. 휴지통 비우기 기능도」).
 * 삭제한 DB 목록 — 골라서 「되돌리기」(원래 자리·STEP 2 기록 그대로) · 「영구 삭제」 · 「휴지통 비우기」.
 * 되돌릴 때 같은 업체가 이미 있으면 알려 주고 「그래도 되돌리기」를 고르게 한다.
 */
import {useEffect,useState} from 'react';
import {Trash2} from 'lucide-react';
import type {DbSheetTrashItem} from '@/types/db-sheet';
import SheetDialog from './SheetDialog';
import {SheetRequestError} from './recording-client';

const when=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

export function TrashDialog({onList,onRestore,onEmpty,onClose}:{onList:()=>Promise<DbSheetTrashItem[]>;onRestore:(ids:string[],allowDuplicate?:boolean)=>Promise<number>;onEmpty:(ids?:string[])=>Promise<void>;onClose:()=>void}){
 const [items,setItems]=useState<DbSheetTrashItem[]|null>(null),[picked,setPicked]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [duplicate,setDuplicate]=useState<string[]|null>(null),[confirmEmpty,setConfirmEmpty]=useState<'picked'|'all'|null>(null);
 const reload=async()=>{try{setItems(await onList());setPicked(new Set());}catch(e){setError((e as Error).message);setItems([]);}};
 useEffect(()=>{void reload();},[]);// eslint-disable-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
 const ids=[...picked];
 async function restore(allow=false){setBusy(true);setError('');setMessage('');try{const n=await onRestore(ids,allow);setDuplicate(null);setMessage(`${n}건을 되돌렸어요.`);await reload();}catch(e){if(e instanceof SheetRequestError&&e.code==='duplicate'){setDuplicate((e.duplicates??[]).map(d=>d.company||d.phone||'이름 없는 업체'));}else setError((e as Error).message);}finally{setBusy(false);}}
 async function empty(){const target=confirmEmpty;setBusy(true);setError('');setMessage('');try{await onEmpty(target==='all'?undefined:ids);setConfirmEmpty(null);setMessage(target==='all'?'휴지통을 비웠어요.':`${ids.length}건을 영구 삭제했어요.`);await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const all=!!items?.length&&picked.size===items.length;
 return <SheetDialog title="휴지통" icon={<Trash2 size={20}/>} onClose={()=>{if(!busy)onClose();}}><div className="dbs-dialog-body dbs-trash">
  {items===null?<p className="dbs-muted">불러오는 중…</p>:!items.length?<p className="dbs-muted">휴지통이 비어 있어요.</p>:<>
   <label className="dbs-check dbs-trash-all"><input type="checkbox" checked={all} onChange={e=>setPicked(e.target.checked?new Set(items.map(i=>i.id)):new Set())}/><span>전체 선택 · {items.length}건</span></label>
   <ul className="dbs-trash-list">{items.map(i=><li key={i.id}><label className="dbs-check"><input type="checkbox" checked={picked.has(i.id)} onChange={e=>{const next=new Set(picked);if(e.target.checked)next.add(i.id);else next.delete(i.id);setPicked(next);}}/>
    <span className="dbs-trash-text"><strong>{i.company||i.owner||'이름 없는 업체'}</strong><small>{[i.phone,i.channel,i.supplier,i.date&&`유입 ${i.date}`].filter(Boolean).join(' · ')}</small></span>
    <small className="dbs-trash-when">{when(i.deletedAt)}</small></label></li>)}</ul>
  </>}
  {duplicate&&<div className="dbs-impact" role="alert"><strong>같은 업체가 이미 있어요</strong><p>{duplicate.join(', ')}</p><div className="dbs-actions"><button className="dbs-button" disabled={busy} onClick={()=>setDuplicate(null)}>취소</button><button className="dbs-button primary" disabled={busy} onClick={()=>void restore(true)}>그래도 되돌리기</button></div></div>}
  {confirmEmpty&&<div className="dbs-impact" role="alert"><strong>{confirmEmpty==='all'?`휴지통의 ${items?.length??0}건을 영구 삭제할까요?`:`${ids.length}건을 영구 삭제할까요?`}</strong><p>영구 삭제하면 되돌릴 수 없어요.</p><div className="dbs-actions"><button className="dbs-button" disabled={busy} onClick={()=>setConfirmEmpty(null)}>취소</button><button className="dbs-button destructive" disabled={busy} onClick={()=>void empty()}>영구 삭제</button></div></div>}
  {message&&<p className="dbs-muted" role="status">{message}</p>}
  {error&&<p className="sheet-error" role="alert">{error}</p>}
 </div><footer className="dbs-dialog-foot dbs-trash-foot">
  <button className="dbs-button" disabled={busy||!items?.length} onClick={()=>setConfirmEmpty('all')}>휴지통 비우기</button>
  <span className="dbs-trash-actions"><button className="dbs-button" disabled={busy||!picked.size} onClick={()=>setConfirmEmpty('picked')}>영구 삭제</button><button className="dbs-button primary" disabled={busy||!picked.size} onClick={()=>void restore()}>{busy?'처리 중…':`되돌리기${picked.size?` ${picked.size}건`:''}`}</button></span>
 </footer></SheetDialog>;
}
