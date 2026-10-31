"use client";
/**
 * 현재상태 끝내기 버튼 두 개(2026-10-23 belie): 「장기관리로 넘기기」(가벼운 거절·나중에 다시) ·
 * 「진행종료」(다시 연락 안 함). 둘 다 오늘 챙길 일에서 빠지고, 「DB컨택중으로 되돌리기」로 되돌린다.
 * 미팅이 연결된 업체는 미팅 단계가 현재상태라 보이지 않는다. AS신청으로 생긴 진행종료는 컨택결과로 바꾼다.
 * 장기관리면 다음 연락일을 1·3·6개월 뒤로 바로 잡는다(2026-10-31 belie) — 날짜만 적어 둔다. 오늘 챙길 일에는 올리지 않는다(「다시 챙기기」로 돌린다).
 */
import {useState} from 'react';
import type {DbSheetManualStage} from '@/types/db-sheet';
import {DATE_PICKS,type Row} from './model';
import {DatePicks} from './DatePicks';

export function StageControls({row,onStage,onNext}:{row:Pick<Row,'stage'|'meetingId'|'result'>&{manualStage?:DbSheetManualStage;next?:string};onStage:(stage:DbSheetManualStage)=>Promise<unknown>;onNext?:(iso:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(row.meetingId)return null;
 const parked=row.manualStage==='장기관리'||row.manualStage==='진행종료';
 if(!parked&&row.result==='AS예정')return null;
 async function go(stage:DbSheetManualStage){setBusy(true);setError('');try{await onStage(stage);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}
 return <div className={`db-stage-controls${parked?' is-parked':''}`}>
  {parked?<>
   <span><strong>{row.manualStage}</strong>{row.manualStage==='장기관리'?' · 오늘 챙길 일에서 빠져 있어요':' · 다시 연락하지 않는 업체예요'}</span>
   <button type="button" className="sheet-btn" disabled={busy} onClick={()=>void go('DB컨택중')}>다시 챙기기</button>
   {row.manualStage==='장기관리'&&onNext&&<span className="db-long-next">다음 연락 <b>{row.next?row.next.slice(2).replaceAll('-','.'):'미정'}</b><DatePicks picks={DATE_PICKS.longTerm} value={row.next??''} label="장기관리 다음 연락일" onPick={onNext}/></span>}
  </>:<>
   <span>더 이상 걸지 않을 거라면</span>
   <span className="db-stage-buttons">
    <button type="button" className="sheet-btn" disabled={busy} title="가벼운 거절·나중에 다시 연락할 업체" onClick={()=>void go('장기관리')}>장기관리로 넘기기</button>
    <button type="button" className="sheet-btn" disabled={busy} title="다시 연락하지 않을 업체" onClick={()=>void go('진행종료')}>진행종료</button>
   </span>
  </>}
  {error&&<small role="alert" className="sheet-error">{error}</small>}
 </div>;
}
