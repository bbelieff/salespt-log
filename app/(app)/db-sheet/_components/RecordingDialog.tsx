import {useState} from 'react';
import {Trash2} from 'lucide-react';
import type {Row} from './model';
import type {Recording,RecordingImpact} from './recording-client';
import SheetDialog from './SheetDialog';
export function RecordingDialog({row,deleting=false,onPreview,onConfirm,onClose}:{row:Row;deleting?:boolean;onPreview:(recording:Recording)=>Promise<RecordingImpact>;onConfirm:(recording:Recording)=>Promise<void>;onClose:()=>void}){
 const [value]=useState<Recording>(row.recording??{inflow:true,activities:true}),[impact,setImpact]=useState<RecordingImpact|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(){setBusy(true);setError('');try{if(!impact){setImpact(await onPreview(value));}else{await onConfirm(value);onClose();}}catch(e){setImpact(null);setError((e as Error).message);}finally{setBusy(false);}}
 return <SheetDialog title={deleting?'DB 영구삭제':'STEP 2 기록 설정'} icon={<Trash2 size={20}/>} onClose={()=>{if(!busy)onClose();}}><div className="dbs-dialog-body"><strong>{row.company}</strong><p className="dbs-muted">삭제하면 되살릴 수 없어요. 연결된 STEP 2 기록도 함께 정리됩니다.</p>{impact&&<><div className="dbs-impact" role="status"><strong>{deleting?'삭제될 STEP 2 기록':'추가될 STEP 2 기록'}</strong><p>유입 {impact.inflow}건 · 상담 {impact.contacts}건 · 미팅 {impact.meetings}건</p>{impact.rows.map((r,i)=><small key={`${r.date}-${r.channel}-${i}`}>{r.date} · {r.channel} · 유입 {r.inflow} / 상담 {r.contacts} / 미팅 {r.meetings}</small>)}</div>{impact.blockedReason&&<p role="alert" className="sheet-error">{impact.blockedReason}</p>}</>}{error&&<p className="sheet-error" role="alert">{error}</p>}</div><footer className="dbs-dialog-foot"><button className="dbs-button" disabled={busy} onClick={onClose}>취소</button><button className={`dbs-button ${deleting&&impact?'destructive':'primary'}`} disabled={busy||!!impact?.blockedReason} onClick={()=>void submit()}>{busy?'확인 중…':!impact?'변경 내용 확인':deleting?'영구삭제':'확인하고 반영'}</button></footer></SheetDialog>;
}
