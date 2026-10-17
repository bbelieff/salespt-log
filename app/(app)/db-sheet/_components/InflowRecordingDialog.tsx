import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import type {Row} from './model';
import type {RecordingImpact} from './recording-client';
import SheetDialog from './SheetDialog';

export function InflowRecordingDialog({row,onPreview,onConfirm,onClose,onActivitySettings}:{
 row:Row;onPreview:(inflow:boolean)=>Promise<RecordingImpact>;onConfirm:(inflow:boolean)=>Promise<void>;onClose:()=>void;onActivitySettings?:()=>void;
}){
 const [inflow,setInflow]=useState(row.inflowStatus?.state==='recorded');
 const [impact,setImpact]=useState<RecordingImpact|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(){
  setBusy(true);setError('');
  try{if(!impact)setImpact(await onPreview(inflow));else{await onConfirm(inflow);onClose();}}
  catch(e){setImpact(null);setError(e instanceof Error?e.message:'변경하지 못했습니다. 다시 확인해 주세요.');}
  finally{setBusy(false);}
 }
 return <SheetDialog title="유입 반영 변경" icon={<RefreshCw size={18}/>} onClose={()=>{if(!busy)onClose();}}>
  <div className="dbs-dialog-body"><strong>{row.company}</strong>
   <div className="db-inflow-choices">{[true,false].map(value=><button type="button" disabled={busy} aria-pressed={inflow===value} key={String(value)} onClick={()=>{setInflow(value);setImpact(null);setError('');}}>{value?'유입 반영':'유입 미반영'}</button>)}</div>
   <p className="dbs-muted">{row.date} · {row.channel} · STEP 2 유입</p>
   {impact&&<div className="dbs-impact" role="status"><strong>{impact.inflow>0?'유입 1건 추가':impact.inflow<0?'이 DB의 유입 1건 반영 취소':'집계 변경 없음'}</strong><p>상담·미팅 기록은 그대로 유지됩니다.</p>{impact.blockedReason&&<p role="alert">{impact.blockedReason}</p>}</div>}
   {error&&<p role="alert" className="sheet-error">{error}</p>}
   {onActivitySettings&&<button type="button" className="sheet-text-btn" disabled={busy} onClick={onActivitySettings}>상담·미팅 반영 설정</button>}
  </div>
  <footer className="dbs-dialog-foot"><button className="dbs-button" disabled={busy} onClick={onClose}>취소</button><button className="dbs-button primary" disabled={busy||!!impact?.blockedReason} onClick={()=>void submit()}>{busy?'확인 중…':impact?'확인하고 변경':'변경 내용 확인'}</button></footer>
 </SheetDialog>;
}
