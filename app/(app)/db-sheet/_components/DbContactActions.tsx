import {ChevronRight,MessageSquare} from 'lucide-react';
import {todayKST} from '@/util/week';
import {outcomes,outcomeLabel,type Row} from './model';
import type {DbSheetManualStage} from '@/types/db-sheet';
import {StageControls} from './StageControls';


/**
 * 컨택결과 묶음(2026-10-26 belie): 결과 드롭다운·컨택내용 버튼(오른쪽 칸을 여는 → 화살표) → 장기관리·진행종료. DB정보 맨 아래(날짜·상담메모·부재 기록 다음).
 * 결과는 늘 오늘 날짜로 기록한다 — 예전 「컨택일」 칸(마지막 통화일이 남아 있던 값)으로 기록하면 다른 날 고친 결과가
 * 그 옛날 기록을 덮었다. date 는 하위 호환용으로만 받고 쓰지 않는다.
 */
export function DbContactActions({row,contact,onResult,onAsInfo,onToggleContact,onStage}:{
 row:Row;date?:string;contact:boolean;onResult:(value:string,date:string)=>void;onStage?:(stage:DbSheetManualStage)=>Promise<unknown>;
 onAsInfo:(value:{asReceived?:boolean;asNote?:string})=>void;onToggleContact:()=>void;
}){
 return <section className="db-contact-actions">
  <div className="db-contact-action-row">
   <label>컨택결과<select aria-label="DB정보 컨택결과" className="sheet-input" value={row.result} onChange={e=>onResult(e.target.value,todayKST())}>
    {outcomes.map(value=><option key={value} value={value}>{outcomeLabel(value,row.recording?.activities!==false)}</option>)}
   </select></label>
   <button type="button" className="db-contact-open" aria-expanded={contact} aria-controls="db-contact-pane" onClick={onToggleContact}>
    <MessageSquare size={15}/><span>컨택내용</span><ChevronRight size={15} aria-hidden="true" className={contact?'db-contact-open-on':''}/>
   </button>
  </div>
  <small className="db-contact-count">업체별 하루 1건 · 기존 기록 유지</small>
  {onStage&&<StageControls row={row} onStage={onStage}/>}
  {row.result==='AS예정'&&<div className="db-as-box">
   <div><strong>AS 확인</strong><span>컨택진행 집계 제외</span></div>
   <label className="db-as-check"><input aria-label="AS 받았어요" type="checkbox" checked={!!row.asReceived} onChange={e=>onAsInfo({asReceived:e.target.checked})}/>{row.asReceived?'AS 받았어요':'AS 받으면 체크하세요'}</label>
   <textarea aria-label="AS 메모" className="sheet-input" placeholder="요청 내용 · 받은 내용" rows={2} maxLength={20000} value={row.asNote??''} onChange={e=>onAsInfo({asNote:e.target.value})}/>
  </div>}
 </section>;
}
