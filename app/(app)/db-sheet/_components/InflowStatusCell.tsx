"use client";
import {useRef,useState} from 'react';
import {CheckCircle2,MinusCircle,HelpCircle} from 'lucide-react';
import type {Row} from './model';
type Props={row:Row;compact?:boolean;iconOnly?:boolean;onOpen?:()=>void;onToggle?:(inflow:boolean)=>Promise<void>;onPendingChange?:(pending:boolean)=>void};
/** List badges navigate; the sole editor lives next to the DB information title. */
export default function InflowStatusCell({row,compact=false,iconOnly=false,onOpen,onToggle,onPendingChange}:Props){
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),lock=useRef(false);
 const status=row.inflowStatus||{state:'unknown',count:0},recorded=status.state==='recorded';
 const label=recorded?'반영됨':status.state==='excluded'?'미반영':'확인 필요',Icon=recorded?CheckCircle2:status.state==='excluded'?MinusCircle:HelpCircle;
 const badge=<><Icon size={12}/>{compact?'유입 ':''}{label}</>;
 async function change(value:boolean){
  if(!onToggle||lock.current||status.state==='unknown'||value===recorded)return;
  lock.current=true;setPending(true);onPendingChange?.(true);setError('');setSaved(false);
  try{await onToggle(value);setSaved(true);}
  catch(failure){setError(failure instanceof Error?failure.message:'저장하지 못했습니다. 기존 상태를 유지합니다.');}
  finally{lock.current=false;setPending(false);onPendingChange?.(false);}
 }
 if(compact&&iconOnly)return <span className={`dbs-inflow-badge sheet-inflow-icon ${status.state}`} role="img" aria-label={`유입 ${label}`} title={`유입 ${label}`}><Icon size={13} aria-hidden="true"/></span>;
 if(compact)return <span className={`dbs-inflow-badge ${status.state}`}>{badge}</span>;
 if(!onToggle)return <button type="button" className={`dbs-inflow-badge ${status.state}`} aria-label={`${row.company} 유입 ${label} DB정보 열기`} onClick={onOpen}>{badge}</button>;
 return <div className="db-inflow-control">
  <div className="db-inflow-toggle" role="radiogroup" aria-label={`${row.company} 유입 반영`} aria-busy={pending}>
   {[true,false].map(value=><button type="button" role="radio" key={String(value)} aria-checked={status.state!=='unknown'&&recorded===value} disabled={pending||status.state==='unknown'} tabIndex={recorded===value?0:-1} onClick={()=>void change(value)} onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const next=event.key==='ArrowLeft'||event.key==='ArrowUp';
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next?0:1]?.focus();void change(next);
   }}>{value?'반영':'미반영'}</button>)}
  </div>
  {pending&&<small role="status">저장 중…</small>}
  {!pending&&saved&&!error&&<small role="status">저장됨</small>}
  {error&&<small role="alert">{error}</small>}
  {status.state==='unknown'&&<small>확인 필요 · 기존 유입 기록을 확인해 주세요.</small>}
 </div>;
}
