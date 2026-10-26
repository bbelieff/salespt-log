import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {DbContactActions} from './DbContactActions';
import './db-detail-compact.css';
import SupplierInput from './SupplierInput';
import InflowStatusCell from './InflowStatusCell';
import {CHANNEL_ORDER} from '@/types/channel';
import React,{useState,useRef,useEffect} from 'react';
import {Row,Key,columns,showsNextContact} from './model';
import {DB_SHEET_AUTO_NEXT_RESULTS,type DbSheetManualStage,type DbSheetAbsence} from '@/types/db-sheet';
import {AbsenceLog} from './AbsenceLog';
import {MeetingLinkPanel} from './MeetingLinkPanel';
import {ContactPanel,ContactDraft} from './ContactPanel';
import {memoSuggestion} from '@/lib/analytics/db-sheet-memo';
import {todayKST} from '@/util/week';
function PanelGrip({label,value,min,max,scale=1,readValue,onChange}:{label:string;value:number;min:number;max:number;scale?:number|(()=>number);readValue?:()=>number;onChange:(n:number)=>void}){
 const start=useRef<{x:number;value:number}|null>(null);
 const apply=(n:number)=>onChange(Math.max(min,Math.min(max,n)));
 return <div className="db-panel-grip" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0} title={`${label} · 드래그로 조절`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start.current={x:e.clientX,value:readValue?readValue():value};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(start.current)apply(start.current.value+(e.clientX-start.current.x)*(typeof scale==='function'?scale():scale));}} onPointerUp={e=>{start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{start.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();apply((readValue?readValue():value)+(e.key==='ArrowLeft'?-1:1)*(max<=100?2:16));}}}/>;
}
const RIGHT_DEFAULT=680,LEGACY_RIGHT_DEFAULT=560;
/** DB정보 칸 순서(2026-10-25 belie): 업체 정보 묶음, 그 아래 원본 메모, 맨 끝 날짜 셋(유입일·최초상담일·다음 연락일). */
const INFO_ORDER_BUSINESS:Key[]=['channel','supplier','company','biz','industry','sales','funds','address','owner','phone','credit','arrears'];
const INFO_ORDER_DATES:Key[]=['date','first','next'];
export function DbDetail({onStage,onAbsence,onLink,row,draft,onChange,onEdit,onResult,onRegister,onOpen,onClose,onDelete,onRestored,onAsInfo,onInflowChange}:{onStage?:(stage:DbSheetManualStage)=>Promise<unknown>;onAbsence?:(entry:DbSheetAbsence,remove?:boolean)=>Promise<unknown>;onLink?:(meetingId:string|null)=>Promise<unknown>;row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onEdit:(k:Key,v:string)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen:()=>void;onClose:()=>void;onDelete:()=>void;onAsInfo:(v:{asReceived?:boolean;asNote?:string})=>void;onRestored?:()=>void|Promise<void>;onInflowChange?:(value:boolean)=>Promise<void>}){
 const [contact,setContact]=useState(false);
 const shell=useRef<HTMLElement>(null);
 const readWidth=(key:string,fallback:number,min:number,max:number)=>{try{const n=Number(localStorage.getItem(key));return n>=min&&n<=max?n:fallback;}catch{return fallback;}};
 const [preferredLeft,setPreferredLeft]=useState(()=>readWidth('db-sheet-panel-left-width',readWidth('db-sheet-panel-closed-width',640,360,1200),360,1200));
 // 업체정보(우열) 기본 680px — 560px 에서는 업체정보 확장보기가 좁아 잘렸다(2026-10-23). 예전 기본값 560 이 그대로 저장된 경우도 새 기본으로 본다.
 const [preferredRight,setPreferredRight]=useState(()=>{const saved=readWidth('db-sheet-panel-right-width',RIGHT_DEFAULT,400,680);return saved===LEGACY_RIGHT_DEFAULT?RIGHT_DEFAULT:saved;});
 const [viewport,setViewport]=useState(()=>typeof window==='undefined'?1280:window.innerWidth),[writing,setWriting]=useState(false);
 useEffect(()=>{const update=()=>setViewport(window.innerWidth);window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
 useEffect(()=>{try{localStorage.setItem('db-sheet-panel-left-width',String(preferredLeft));localStorage.setItem('db-sheet-panel-right-width',String(preferredRight));}catch{}},[preferredLeft,preferredRight]);
 const desktop=viewport>=1024,available=Math.max(0,viewport-24);
 const right=desktop?Math.min(preferredRight,available-361):preferredRight;
 const maxLeft=desktop?available-right-1:1200,left=desktop?Math.max(360,Math.min(preferredLeft,maxLeft)):preferredLeft;
 const maxRight=desktop?Math.min(680,available-361):680;
 const changeLeft=(value:number)=>{setPreferredRight(right);setPreferredLeft(Math.round(Math.max(360,Math.min(value,maxLeft))));};
 const changeRight=(value:number)=>{const next=Math.round(Math.max(400,Math.min(value,maxRight)));const restored=left-(next-right);setPreferredLeft(Math.max(360,Math.min(1200,restored,desktop?available-next-1:1200)));setPreferredRight(next);};
 const finishClose=()=>{if(!writing)onClose();};
 // 부재·재통화는 다음 연락일을 컨택한 다음날로 자동으로 잡는다 — 그 칸을 노랗게 보여 주고 바꿀 수 있다고 알린다(2026-10-25 belie).
 const autoNext=DB_SHEET_AUTO_NEXT_RESULTS.includes(row.result);

 const infoField=(c:(typeof columns)[number])=><label key={c.key} className={`${c.key==='supplier'?'db-fill-row':''} ${c.key==='next'&&autoNext?'db-next-auto':''}`}>{c.label}{c.key==='channel'?<select aria-label="DB정보 공급처 유형" className="sheet-input" value={row.channel} disabled={!!row.meetingId} title={row.meetingId?"미팅예약된 업체의 유형은 컨택관리에서 변경해 주세요.":undefined} onChange={e=>onEdit("channel",e.target.value)}>{CHANNEL_ORDER.map(channel=><option key={channel}>{channel}</option>)}</select>:c.key==='supplier'?<SupplierInput aria-label="DB정보 공급처" className="sheet-input" value={row.supplier} onValueChange={v=>onEdit("supplier",v)}/>:<input aria-label={`DB정보 ${c.label}`} type={c.key==='date'||c.key==='next'||c.key==='first'?'date':'text'} className="sheet-input" value={row[c.key]} onInput={e=>{if(c.key==="date"||c.key==="next"||c.key==="first")onEdit(c.key,e.currentTarget.value);}} onChange={e=>onEdit(c.key,e.target.value)}/>}{c.key==='next'&&autoNext&&<small className="db-next-hint" role="status">{row.next?'다음날로 자동 입력 · 바꿀 수 있어요':'다음 연락일을 정해 주세요'}</small>}</label>;
 // 메모에 적힌 부재·컨택결과 제안(2026-10-26 belie) — 기록은 누를 때만.
 const memo=memoSuggestion(row,todayKST());
 return <div className="sheet-overlay sheet-detail-overlay" onClick={finishClose}><section className={`db-detail-shell ${contact?'with-contact':''}`} ref={shell} style={{"--db-panel-width":`${contact?left+right+1:left}px`,"--db-left-width":`${left}px`,"--db-right-width":`${right}px`} as React.CSSProperties} role="dialog" aria-modal="true" aria-label="DB정보" onClick={e=>e.stopPropagation()}>
  <div className="db-outer-grip"><PanelGrip label="좌열 왼쪽 바깥 테두리 너비 조절" value={left} readValue={()=>left} min={360} max={maxLeft} scale={-1} onChange={changeLeft}/></div>
  <header className="db-detail-header"><div><span className="sheet-eyebrow">DB정보</span><div className="db-detail-title"><h2>{row.company}</h2><div className="db-title-inflow"><span>유입 반영</span><InflowStatusCell row={row} onToggle={onInflowChange} onPendingChange={setWriting}/></div></div></div><button className="sheet-text-btn db-width-toggle" disabled={maxLeft<=440} onClick={()=>changeLeft(left<=440?640:440)}>{left<=440?"기본 너비":"좁게 보기"}</button><button className="sheet-btn" disabled={writing} aria-label="DB정보 닫기" onClick={finishClose}>✕</button></header>
  <div className="db-detail-columns"><section className="db-info-pane">
   {/* 칸 순서(2026-10-25·26 belie 확정): 공급처 → 사업자 → 매출·필요자금·주소 → 대표자 → 체납 → 원본 메모 → 날짜 셋(강조, 유입 › 최초상담 › 다음 연락) → 컨택결과 묶음. */}
   <div className="db-info-fields">{INFO_ORDER_BUSINESS.map(k=>columns.find(c=>c.key===k)!).map(infoField)}</div>
   {row.memo&&<details className="db-previous-notes"><summary>받은 DB의 원본 메모 보기</summary><p>{row.memo}</p></details>}
   <div className="db-info-fields db-info-dates">{INFO_ORDER_DATES.filter(k=>k!=='next'||showsNextContact(row.result)).map(k=>columns.find(c=>c.key===k)!).map(infoField)}</div>
   {/* 날짜 아래(2026-10-26 belie): 상담메모 → 부재 기록 → 컨택결과 묶음(결과·컨택내용 →·장기관리·진행종료) → 따로 잡은 미팅. 「컨택내용」 제목·컨택일 칸은 없앰(최초상담일과 겹침). */}
   <div className="db-contact-bottom"><label className="db-note-label db-contact-memo">상담메모<textarea aria-label="상담메모" className="sheet-input" rows={2} placeholder="통화 내용·요청사항" value={draft.note} onChange={e=>onChange({...draft,note:e.target.value})}/></label>{onAbsence&&row.result!=='단순거절'&&<AbsenceLog row={row} onAbsence={onAbsence} suggested={memo.absenceDates}/>}<DbContactActions suggestion={memo.result} row={row} contact={contact} onResult={onResult} onAsInfo={onAsInfo} onToggleContact={()=>setContact(!contact)} onStage={onStage}/>{onLink&&<MeetingLinkPanel row={row} onLink={onLink}/>}</div>
   <div className="db-detail-bottom-actions"><button className="sheet-text-btn dbs-delete" onClick={onDelete}>삭제</button></div>
  </section>{contact&&<div className="db-split-grip"><PanelGrip label="우열 중앙 경계 너비 조절" value={right} readValue={()=>right} min={400} max={maxRight} scale={-1} onChange={changeRight}/></div>}{contact&&<section id="db-contact-pane" className="db-contact-pane"><div className="db-contact-header"><div><h3>업체정보 · 미팅예약</h3></div><button className="sheet-text-btn" onClick={()=>setContact(false)}>접기 <DisclosureChevron open /></button></div><ContactPanel onRestored={onRestored} showContact={false} onCompany={v=>onEdit("company",v)} row={row} draft={draft} onChange={onChange} onResult={onResult} onRegister={onRegister} onOpen={onOpen}/></section>}</div>
 </section></div>;
}
