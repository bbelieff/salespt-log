import {useState} from 'react';
import {CheckCircle2,MinusCircle,HelpCircle} from 'lucide-react';
import type {Row} from './model';
import SheetDialog from './SheetDialog';
export default function InflowStatusCell({row,compact=false,onRecording}:{row:Row;compact?:boolean;onRecording?:()=>void}){
 const [open,setOpen]=useState(false),status=row.inflowStatus||{state:'unknown',count:0};
 const label=status.state==='recorded'?'반영됨':status.state==='excluded'?'미반영':'확인 필요',Icon=status.state==='recorded'?CheckCircle2:status.state==='excluded'?MinusCircle:HelpCircle;
 const badge=<><Icon size={12}/>{compact?'유입 ':''}{label}</>;
 if(compact)return <span className={`dbs-inflow-badge ${status.state}`}>{badge}</span>;
 return <><button type="button" className={`dbs-inflow-badge ${status.state}`} aria-label={`${row.company} 유입 ${label} 상세`} onClick={()=>setOpen(true)}>{badge}</button>{open&&<SheetDialog title="유입 반영 내역" icon={<Icon size={20}/>} onClose={()=>setOpen(false)}><div className="dbs-dialog-body"><strong>{row.company}</strong><span className={`dbs-inflow-badge ${status.state}`}>{badge}</span>{status.state==='recorded'?<dl className="dbs-inflow-detail"><div><dt>반영 위치</dt><dd>STEP 2 · 컨택관리</dd></div><div><dt>유입일</dt><dd>{status.date}</dd></div><div><dt>채널</dt><dd>{status.channel}</dd></div><div><dt>반영 건수</dt><dd>유입 {status.count}건</dd></div></dl>:<p className="dbs-muted">{status.state==='excluded'?'유입 숫자에 반영하지 않은 DB예요.':'이전 유입 집계와 연결된 기록이 없어요. 기존 컨택관리 기록을 확인해 주세요.'}</p>}<p className="dbs-muted">상담·미팅 반영 여부는 별도예요.</p></div><footer className="dbs-dialog-foot">{onRecording&&<button className="dbs-button" onClick={()=>{setOpen(false);onRecording();}}>반영 변경</button>}<button className="dbs-button primary" onClick={()=>setOpen(false)}>확인</button></footer></SheetDialog>}</>;
}
