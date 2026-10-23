import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {CalendarDays,MessageSquare} from 'lucide-react';
import {todayKST} from '@/util/week';
import {needsRecallDate,outcomes,outcomeLabel,type Row} from './model';
import type {DbSheetManualStage} from '@/types/db-sheet';
import {StageControls} from './StageControls';

/** 상세 화면의 「다음 연락일」 칸으로 이동해 달력을 연다. */
function focusNextContact(){const input=document.querySelector<HTMLInputElement>('input[aria-label="DB정보 다음 연락일"]');if(!input)return;input.scrollIntoView({block:'center'});input.focus();try{input.showPicker();}catch{}}

export function DbContactActions({row,date,contact,onResult,onAsInfo,onToggleContact,onStage}:{
 row:Row;date:string;contact:boolean;onResult:(value:string,date:string)=>void;onStage?:(stage:DbSheetManualStage)=>Promise<unknown>;
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
  {needsRecallDate(row)&&<div className="db-as-box db-recall-notice" role="status">
   <div><strong>재통화 일정을 정해 주세요</strong><span>다음 연락일을 넣으면 그날 다시 알려 드려요</span></div>
   <button type="button" className="db-contact-open" onClick={focusNextContact}><CalendarDays size={15} aria-hidden="true"/>다음 연락일 정하기</button>
  </div>}
  {onStage&&<StageControls row={row} onStage={onStage}/>}
  {row.result==='AS예정'&&<div className="db-as-box">
   <div><strong>AS 확인</strong><span>컨택진행 집계 제외</span></div>
   <label className="db-as-check"><input aria-label="AS 받았어요" type="checkbox" checked={!!row.asReceived} onChange={e=>onAsInfo({asReceived:e.target.checked})}/>{row.asReceived?'AS 받았어요':'AS 받으면 체크하세요'}</label>
   <textarea aria-label="AS 메모" className="sheet-input" placeholder="요청 내용 · 받은 내용" rows={2} maxLength={20000} value={row.asNote??''} onChange={e=>onAsInfo({asNote:e.target.value})}/>
  </div>}
 </section>;
}
