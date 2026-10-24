import DisclosureChevron from '@/components/ui/DisclosureChevron';
import {DbContactActions} from './DbContactActions';
import './db-detail-compact.css';
import SupplierInput from './SupplierInput';
import InflowStatusCell from './InflowStatusCell';
import {CHANNEL_ORDER} from '@/types/channel';
import React,{useState,useRef,useEffect} from 'react';
import {Row,Key,columns,showsNextContact} from './model';
import type {DbSheetManualStage,DbSheetAbsence} from '@/types/db-sheet';
import {AbsenceLog} from './AbsenceLog';
import {MeetingLinkPanel} from './MeetingLinkPanel';
import {ContactPanel,ContactDraft,ContactFields} from './ContactPanel';
function PanelGrip({label,value,min,max,scale=1,readValue,onChange}:{label:string;value:number;min:number;max:number;scale?:number|(()=>number);readValue?:()=>number;onChange:(n:number)=>void}){
 const start=useRef<{x:number;value:number}|null>(null);
 const apply=(n:number)=>onChange(Math.max(min,Math.min(max,n)));
 return <div className="db-panel-grip" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0} title={`${label} · 드래그로 조절`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start.current={x:e.clientX,value:readValue?readValue():value};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(start.current)apply(start.current.value+(e.clientX-start.current.x)*(typeof scale==='function'?scale():scale));}} onPointerUp={e=>{start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{start.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();apply((readValue?readValue():value)+(e.key==='ArrowLeft'?-1:1)*(max<=100?2:16));}}}/>;
}
const RIGHT_DEFAULT=680,LEGACY_RIGHT_DEFAULT=560;
export function DbDetail({onStage,onAbsence,onLink,row,draft,onChange,onEdit,onResult,onRegister,onOpen,onClose,onRecording,onDelete,onRestored,onAsInfo,onInflowChange}:{onStage?:(stage:DbSheetManualStage)=>Promise<unknown>;onAbsence?:(entry:DbSheetAbsence,remove?:boolean)=>Promise<unknown>;onLink?:(meetingId:string|null)=>Promise<unknown>;row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onEdit:(k:Key,v:string)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen:()=>void;onClose:()=>void;onRecording:()=>void;onDelete:()=>void;onAsInfo:(v:{asReceived?:boolean;asNote?:string})=>void;onRestored?:()=>void|Promise<void>;onInflowChange?:(value:boolean)=>Promise<void>}){
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

 return <div className="sheet-overlay sheet-detail-overlay" onClick={finishClose}><section className={`db-detail-shell ${contact?'with-contact':''}`} ref={shell} style={{"--db-panel-width":`${contact?left+right+1:left}px`,"--db-left-width":`${left}px`,"--db-right-width":`${right}px`} as React.CSSProperties} role="dialog" aria-modal="true" aria-label="DB정보" onClick={e=>e.stopPropagation()}>
  <div className="db-outer-grip"><PanelGrip label="좌열 왼쪽 바깥 테두리 너비 조절" value={left} readValue={()=>left} min={360} max={maxLeft} scale={-1} onChange={changeLeft}/></div>
  <header className="db-detail-header"><div><span className="sheet-eyebrow">DB정보</span><div className="db-detail-title"><h2>{row.company}</h2><div className="db-title-inflow"><span>유입 반영</span><InflowStatusCell row={row} onToggle={onInflowChange} onPendingChange={setWriting}/></div></div></div><button className="sheet-text-btn db-width-toggle" disabled={maxLeft<=440} onClick={()=>changeLeft(left<=440?640:440)}>{left<=440?"기본 너비":"좁게 보기"}</button><button className="sheet-btn" disabled={writing} aria-label="DB정보 닫기" onClick={finishClose}>✕</button></header>
  <div className="db-detail-columns"><section className="db-info-pane"><DbContactActions row={row} date={draft.date} contact={contact} onResult={onResult} onAsInfo={onAsInfo} onToggleContact={()=>setContact(!contact)} onStage={onStage}/>{onLink&&<MeetingLinkPanel row={row} onLink={onLink}/>}{onAbsence&&row.result!=='단순거절'&&<AbsenceLog row={row} onAbsence={onAbsence}/>}{contact&&<section className="db-call-left"><div className="db-call-heading"><h3>컨택내용</h3></div><ContactFields row={row} draft={draft} onChange={onChange} onResult={onResult}/></section>}
   <div className="db-info-fields">{columns.filter(c=>!c.auto&&c.key!=='memo'&&c.key!=='result'&&(c.key!=='next'||showsNextContact(row.result))).map(c=><label key={c.key} className={`${c.key==='address'?'db-wide':''} ${['company','funds','industry','arrears'].includes(c.key)?'db-field-full-narrow':''}`}>{c.label}{c.key==='channel'?<select aria-label="DB정보 공급처 유형" className="sheet-input" value={row.channel} disabled={!!row.meetingId} title={row.meetingId?"미팅예약된 업체의 유형은 컨택관리에서 변경해 주세요.":undefined} onChange={e=>onEdit("channel",e.target.value)}>{CHANNEL_ORDER.map(channel=><option key={channel}>{channel}</option>)}</select>:c.key==='supplier'?<SupplierInput aria-label="DB정보 공급처" className="sheet-input" value={row.supplier} onValueChange={v=>onEdit("supplier",v)}/>:<input aria-label={`DB정보 ${c.label}`} type={c.key==='date'||c.key==='next'||c.key==='first'?'date':'text'} className="sheet-input" value={row[c.key]} onInput={e=>{if(c.key==="date"||c.key==="next"||c.key==="first")onEdit(c.key,e.currentTarget.value);}} onChange={e=>onEdit(c.key,e.target.value)}/>}</label>)}</div>
   {row.memo&&<details className="db-previous-notes"><summary>받은 DB의 원본 메모 보기</summary><p>{row.memo}</p></details>}
   <div className="db-detail-bottom-actions"><button className="sheet-text-btn" onClick={onRecording}>상담·미팅 반영 설정</button><button className="sheet-text-btn dbs-delete" onClick={onDelete}>영구삭제</button></div>
  </section>{contact&&<div className="db-split-grip"><PanelGrip label="우열 중앙 경계 너비 조절" value={right} readValue={()=>right} min={400} max={maxRight} scale={-1} onChange={changeRight}/></div>}{contact&&<section id="db-contact-pane" className="db-contact-pane"><div className="db-contact-header"><div><h3>업체정보 · 미팅예약</h3></div><button className="sheet-text-btn" onClick={()=>setContact(false)}>접기 <DisclosureChevron open /></button></div><ContactPanel onRestored={onRestored} showContact={false} onCompany={v=>onEdit("company",v)} row={row} draft={draft} onChange={onChange} onResult={onResult} onRegister={onRegister} onOpen={onOpen}/></section>}</div>
 </section></div>;
}
