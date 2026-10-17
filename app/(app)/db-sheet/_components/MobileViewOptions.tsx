"use client";
import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type Props={open:boolean;count:number;onClose:()=>void;onReset:()=>void;children?:ReactNode};
const focusable='button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]';
/** A non-native modal keeps the existing body-portaled date/supplier popovers interactive. */
export default function MobileViewOptions({open,count,onClose,onReset,children}:Props){
 const panel=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const frame=document.querySelector<HTMLElement>('[data-db-sheet-frame]'),wasInert=frame?.inert;
  if(frame)frame.inert=true;
  panel.current?.querySelector<HTMLButtonElement>('[data-options-close]')?.focus();
  const nested=()=>document.querySelector<HTMLElement>('.sheet-filter-popover');
  const targets=(scope:HTMLElement)=>Array.from(scope.querySelectorAll<HTMLElement>(focusable)).filter(el=>el.getClientRects().length>0);
  const key=(event:KeyboardEvent)=>{
   const child=nested();
   if(event.key==='Escape'&&!event.defaultPrevented&&!child){event.preventDefault();close.current();return;}
   if(event.key!=='Tab')return;
   const scope=child??panel.current;if(!scope)return;
   const items=targets(scope),first=items[0],last=items.at(-1);
   if(!first){event.preventDefault();scope.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  const focus=(event:FocusEvent)=>{const child=nested();if(panel.current?.contains(event.target as Node)||child?.contains(event.target as Node))return;targets(child??panel.current!)[0]?.focus();};
  document.addEventListener('keydown',key);document.addEventListener('focusin',focus);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('focusin',focus);if(frame)frame.inert=wasInert??false;(document.querySelector<HTMLElement>('.sheet-view-options-trigger')??previous)?.focus();};
 },[open]);
 if(!open)return null;
 return createPortal(<div className="sheet-options-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget){event.preventDefault();onClose();}}}>
  <div ref={panel} className="sheet-mobile-options" role="dialog" aria-modal="true" aria-labelledby="db-view-options-title" tabIndex={-1}>
   <header><div className="sheet-options-heading"><h2 id="db-view-options-title">보기 옵션</h2><span className="sheet-options-count">{count}건</span></div><button type="button" data-options-close aria-label="보기 옵션 닫기" onClick={onClose}>닫기 ×</button></header>
   <div className="sheet-options-body">{children}</div>
   <footer><button type="button" className="sheet-text-btn" onClick={onReset}>필터 초기화</button></footer>
  </div>
 </div>,document.body);
}
