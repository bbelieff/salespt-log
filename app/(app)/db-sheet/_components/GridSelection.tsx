"use client";
/** 표의 줄 선택 체크칸·전체 선택·재통화 일정 안내 줄(2026-10-23 belie). 줄 나머지를 누르면 DB정보가 열리므로 체크칸은 클릭을 삼킨다. */
import {useEffect,useRef} from 'react';
import {CalendarDays} from 'lucide-react';
import type {Row} from './model';

export function RowCheck({row,checked,onSelect}:{row:Pick<Row,'id'|'company'>;checked:boolean;onSelect:(ids:string[],checked:boolean)=>void}){
 return <label className="sheet-row-check" onClick={e=>e.stopPropagation()}>
  <input type="checkbox" aria-label={`${row.company||'이름 없는 업체'} 선택`} checked={checked} onChange={e=>onSelect([row.id],e.target.checked)}/>
 </label>;
}

/** 보이는 줄 전체 선택 — 일부만 고르면 가운데 줄(indeterminate) 표시. */
export function SelectAllCheck({ids,selected,onSelect}:{ids:string[];selected:ReadonlySet<string>;onSelect:(ids:string[],checked:boolean)=>void}){
 const ref=useRef<HTMLInputElement>(null);
 const count=ids.filter(id=>selected.has(id)).length,all=ids.length>0&&count===ids.length;
 useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&!all;},[count,all]);
 return <label className="sheet-row-check" onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
  <input ref={ref} type="checkbox" aria-label="보이는 줄 전체 선택" disabled={!ids.length} checked={all} onChange={e=>onSelect(ids,e.target.checked)}/>
 </label>;
}

/** 표에서 컨택결과를 재통화로 바꿨는데 다음 연락일이 비었을 때 그 줄 바로 아래에 띄우는 안내(DB정보 안내와 같은 문구). */
export function RecallRow({span,width,company,onSchedule}:{span:number;width:number;company:string;onSchedule:()=>void}){
 return <tr className="sheet-recall-row"><td colSpan={span}>
  <div className="sheet-recall-notice" role="status" style={width?{maxWidth:width}:undefined}>
   <div><strong>재통화 일정을 정해 주세요</strong><span>{company?`${company} · `:''}다음 연락일을 넣으면 그날 다시 알려 드려요</span></div>
   <button type="button" className="sheet-recall-action" onClick={onSchedule}><CalendarDays size={14} aria-hidden="true"/>다음 연락일 정하기</button>
  </div>
 </td></tr>;
}
