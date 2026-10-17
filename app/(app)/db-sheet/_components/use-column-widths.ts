import {useEffect,useLayoutEffect,useState,type RefObject} from 'react';
import {clampColumnWidth,measureColumnWidths} from './column-widths';
import type {Row} from './model';

export function useColumnWidths(grid:RefObject<HTMLDivElement|null>,rows:Row[],keys:string,tableVisible:boolean){
 const [manual,setManual]=useState<Record<string,number>>(()=>{
  try{const saved=JSON.parse(localStorage.getItem('db-sheet-column-widths')||'{}'),valid:Record<string,number>={};if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [key,value] of Object.entries(saved))if(typeof value==='number'&&Number.isFinite(value)&&value>0)valid[key]=value;return valid;}catch{return {};}
 });
 const [automatic,setAutomatic]=useState<Record<string,number>>({});
 useEffect(()=>{localStorage.setItem('db-sheet-column-widths',JSON.stringify(manual));},[manual]);
 useLayoutEffect(()=>{
  if(!tableVisible)return;
  let alive=true;
  const measure=()=>{if(!alive||!grid.current)return;const next=measureColumnWidths(grid.current,rows);setAutomatic(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);};
  measure();void document.fonts?.ready.then(measure);document.fonts?.addEventListener('loadingdone',measure);
  return()=>{alive=false;document.fonts?.removeEventListener('loadingdone',measure);};
 },[grid,rows,keys,tableVisible]);
 return {
  width:(key:string,fallback:number)=>clampColumnWidth(manual[key]||automatic[key]||fallback),
  resize:(key:string,value:number)=>setManual(old=>({...old,[key]:clampColumnWidth(value)})),
  fit:(key:string)=>setManual(old=>{const next={...old};delete next[key];return next;}),
  reset:()=>setManual({}),
 };
}
