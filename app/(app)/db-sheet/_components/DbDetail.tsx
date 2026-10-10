import React,{useState,useRef,useEffect} from 'react';
import {Row,Key,columns,showsNextContact} from './model';
import {ContactPanel,ContactDraft,ContactFields} from './ContactPanel';
function PanelGrip({label,value,min,max,scale=1,readValue,onChange}:{label:string;value:number;min:number;max:number;scale?:number|(()=>number);readValue?:()=>number;onChange:(n:number)=>void}){
 const start=useRef<{x:number;value:number}|null>(null);
 const apply=(n:number)=>onChange(Math.max(min,Math.min(max,n)));
 return <div className="db-panel-grip" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={max} tabIndex={0} title={`${label} · 드래그로 조절`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start.current={x:e.clientX,value:readValue?readValue():value};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(start.current)apply(start.current.value+(e.clientX-start.current.x)*(typeof scale==='function'?scale():scale));}} onPointerUp={e=>{start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{start.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();apply((readValue?readValue():value)+(e.key==='ArrowLeft'?-1:1)*(max<=100?2:16));}}}/>;
}
export function DbDetail({row,draft,onChange,onEdit,onResult,onRegister,onOpen,onClose}:{row:Row;draft:ContactDraft;onChange:(v:ContactDraft)=>void;onEdit:(k:Key,v:string)=>void;onResult:(v:string,date:string)=>void;onRegister:()=>void;onOpen:()=>void;onClose:()=>void}){
 const [contact,setContact]=useState(false);
 const shell=useRef<HTMLElement>(null);
 const [panelWidth,setPanelWidth]=useState(()=>Number(localStorage.getItem('db-sheet-panel-width'))||1460);
 const [closedWidth,setClosedWidth]=useState(()=>Number(localStorage.getItem('db-sheet-panel-closed-width'))||860);
 useEffect(()=>{localStorage.setItem('db-sheet-panel-closed-width',String(closedWidth));},[closedWidth]);
 const [split,setSplit]=useState(()=>Math.max(30,Math.min(60,Number(localStorage.getItem('db-sheet-panel-split'))||43)));
 useEffect(()=>{localStorage.setItem('db-sheet-panel-width',String(panelWidth));},[panelWidth]);
 useEffect(()=>{localStorage.setItem('db-sheet-panel-split',String(split));},[split]);
 return <div className="sheet-overlay sheet-detail-overlay" onClick={onClose}><section className={`db-detail-shell ${contact?'with-contact':''}`} ref={shell} style={{"--db-panel-width":`${contact?panelWidth:closedWidth}px`,"--db-split":`${split}%`} as React.CSSProperties} role="dialog" aria-modal="true" aria-label="DB정보" onClick={e=>e.stopPropagation()}>
  <div className="db-outer-grip"><PanelGrip label="사이드패널 너비 조절" value={Math.min(contact?panelWidth:closedWidth,window.innerWidth-24)} readValue={()=>shell.current?.getBoundingClientRect().width||panelWidth} min={740} max={Math.max(740,window.innerWidth-24)} scale={-1} onChange={contact?setPanelWidth:setClosedWidth}/></div>
  <header className="db-detail-header"><div><span className="sheet-eyebrow">DB정보</span><h2>{row.company}</h2></div><button className="sheet-btn" aria-label="DB정보 닫기" onClick={onClose}>✕</button></header>
  <div className="db-detail-columns"><section className="db-info-pane">{contact&&<section className="db-call-left"><div className="db-call-heading"><h3>컨택내용</h3><span className="db-first-contact">최초상담일 <strong>{row.first||'—'}</strong> <span className="auto-label">자동</span></span></div><ContactFields row={row} draft={draft} onChange={onChange} onResult={onResult}/></section>}
   <div className="db-info-fields">{columns.filter(c=>!c.auto&&c.key!=='memo'&&c.key!=='result'&&(c.key!=='next'||showsNextContact(row.result))).map(c=><label key={c.key} className={`${c.key==='address'?'db-wide':''} ${['company','funds','industry','arrears'].includes(c.key)?'db-field-full-narrow':''}`}>{c.label}<input aria-label={`DB정보 ${c.label}`} type={c.key==='date'||c.key==='next'?'date':'text'} className="sheet-input" value={row[c.key]} onInput={e=>{if(c.key==="date"||c.key==="next")onEdit(c.key,e.currentTarget.value);}} onChange={e=>onEdit(c.key,e.target.value)}/></label>)}</div>
   {row.memo&&<details className="db-previous-notes"><summary>받은 DB의 원본 메모 보기</summary><p>{row.memo}</p></details>}
   <button className={`db-contact-toggle ${contact?'is-open':''}`} aria-expanded={contact} aria-controls="db-contact-pane" onClick={()=>setContact(!contact)}><span><strong>컨택내용</strong><small>통화 기록 · 기본정보 · 미팅예약</small></span><span aria-hidden="true">{contact?'‹':'›'}</span></button>
  </section>{contact&&<div className="db-split-grip"><PanelGrip label="좌우 분할비율 조절" value={split} min={30} max={60} scale={()=>100/(shell.current?.clientWidth||panelWidth)} onChange={setSplit}/></div>}{contact&&<section id="db-contact-pane" className="db-contact-pane"><div className="db-contact-header"><div><h3>업체정보 · 미팅예약</h3></div><button className="sheet-text-btn" onClick={()=>setContact(false)}>접기 ‹</button></div><ContactPanel showContact={false} onCompany={v=>onEdit("company",v)} row={row} draft={draft} onChange={onChange} onResult={onResult} onRegister={onRegister} onOpen={onOpen}/></section>}</div>
 </section></div>;
}
