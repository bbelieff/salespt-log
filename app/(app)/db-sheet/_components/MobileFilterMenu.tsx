"use client";
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
type Props={title:string;anchor:HTMLElement;onClose:()=>void;children?:ReactNode};
const selector='button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]';
/** Mobile-only anchored filters; existing range/supplier body portals remain the nested focus scope. */
export default function MobileFilterMenu({title,anchor,onClose,children}:Props){
 const panel=useRef<HTMLDivElement>(null),close=useRef(onClose),restore=useRef(true);close.current=onClose;
 const [position,setPosition]=useState({left:12,top:12,width:296,maxHeight:300});
 useLayoutEffect(()=>{
  const place=()=>{const r=anchor.getBoundingClientRect(),width=Math.min(360,innerWidth-24),top=Math.max(12,Math.min(r.bottom+4,innerHeight-180));setPosition({left:Math.max(12,Math.min(r.left,innerWidth-width-12)),top,width,maxHeight:Math.max(140,innerHeight-top-92)});};
  place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);
 },[anchor]);
 useEffect(()=>{
  const nested=()=>document.querySelector<HTMLElement>('.sheet-filter-popover');
  const items=(scope:HTMLElement)=>Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(el=>el.getClientRects().length>0);
  panel.current?.querySelector<HTMLButtonElement>('[data-filter-close]')?.focus();
  const key=(event:KeyboardEvent)=>{const child=nested();if(event.key==='Escape'&&!event.defaultPrevented&&!child){event.preventDefault();close.current();return;}if(event.key!=='Tab')return;const scope=child??panel.current;if(!scope)return;const all=items(scope),first=all[0],last=all.at(-1);if(!first){event.preventDefault();scope.focus();}else if(event.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){event.preventDefault();first.focus();}};
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!panel.current?.contains(event.target)&&!anchor.contains(event.target)&&!nested()?.contains(event.target)){restore.current=false;close.current();}};
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);if(restore.current)anchor.focus();};
 },[anchor]);
 return createPortal(<div ref={panel} className="sheet-mobile-filter-menu" role="dialog" aria-label={`${title} 필터 선택`} tabIndex={-1} style={position}><header><strong>{title}</strong><button type="button" data-filter-close aria-label={`${title} 필터 닫기`} onClick={onClose}>닫기</button></header>{children}</div>,document.body);
}
