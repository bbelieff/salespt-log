import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {MessageSquare} from 'lucide-react';
import {todayKST} from '@/util/week';
import {outcomes,outcomeLabel,type Row} from './model';

export function DbContactActions({row,date,contact,onResult,onAsInfo,onToggleContact}:{
 row:Row;date:string;contact:boolean;onResult:(value:string,date:string)=>void;
 onAsInfo:(value:{asReceived?:boolean;asNote?:string})=>void;onToggleContact:()=>void;
}){
 return <section className="db-contact-actions">
  <div className="db-contact-action-row">
   <label>컨택결과<select aria-label="DB정보 컨택결과" className="sheet-input" value={row.result} onChange={e=>onResult(e.target.value,date||todayKST())}>
    {outcomes.map(value=><option key={value} value={value}>{outcomeLabel(value,row.recording?.activities!==false)}</option>)}
   </select></label>
   <button type="button" className="db-contact-open" aria-expanded={contact} aria-controls="db-contact-pane" onClick={onToggleContact}>
    <MessageSquare size={15}/><span>컨택내용</span><DisclosureChevron open={contact} />
   </button>
  </div>
  <small className="db-contact-count">업체별 하루 1건 · 기존 기록 유지</small>
  {row.result==='AS예정'&&<div className="db-as-box">
   <div><strong>AS 확인</strong><span>컨택진행 집계 제외</span></div>
   <label className="db-as-check"><input aria-label="AS 받았어요" type="checkbox" checked={!!row.asReceived} onChange={e=>onAsInfo({asReceived:e.target.checked})}/>{row.asReceived?'AS 받았어요':'AS 받으면 체크하세요'}</label>
   <textarea aria-label="AS 메모" className="sheet-input" placeholder="요청 내용 · 받은 내용" rows={2} maxLength={20000} value={row.asNote??''} onChange={e=>onAsInfo({asNote:e.target.value})}/>
  </div>}
 </section>;
}
