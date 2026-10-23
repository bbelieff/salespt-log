/**
 * 「보여줄 항목」 저장값 되살리기. v6(2026-10-23): 다음 연락일이 표에서 바로 고치는 칸이 되어
 * 예전 저장값(v5 이하)에 없으면 컨택결과 바로 뒤에 한 번 넣는다. 사용자가 v6 에서 다시 끄면 그대로 둔다.
 */
import {columns,type Key} from './model';

export function restoreVisibleColumns(read:(key:string)=>string|null):Key[]|null{
 const v6=read('db-sheet-v6-columns');
 const v5=v6===null?read('db-sheet-v5-columns'):null;
 const raw=v6??v5??read('db-sheet-v4-columns')??read('db-sheet-v3-columns');
 const parsed:unknown=JSON.parse(raw||'null');
 if(!Array.isArray(parsed))return null;
 const keys=parsed.filter((k):k is Key=>columns.some(c=>c.key===k));
 if(v6!==null)return keys;
 if(v5===null){
  if(!keys.includes('inflow'))keys.splice(Math.max(0,keys.indexOf('date')+1),0,'inflow');
  if(!keys.includes('channel'))keys.splice(Math.max(0,keys.indexOf('supplier')),0,'channel');
 }
 if(!keys.includes('next')){const at=keys.indexOf('result');keys.splice(at<0?keys.length:at+1,0,'next');}
 return keys;
}
