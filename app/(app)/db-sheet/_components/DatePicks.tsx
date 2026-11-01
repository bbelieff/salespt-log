import {todayKST} from '@/util/week';
import {shiftISODate} from './model';

/** 날짜 칸 제목 옆 바로 넣기 버튼(2026-10-31 belie). 같은 날짜면 눌림으로 보인다. onClear 가 있으면 날짜가 있을 때 「지우기」(아이폰 달력 「재설정」은 원래 날짜로 돌아가 못 지운다, 2026-11-01). */
export function DatePicks({picks,value,label,onPick,onClear}:{picks:readonly (readonly [string,{days?:number;months?:number}])[];value:string;label:string;onPick:(iso:string)=>void;onClear?:()=>void}){
 const today=todayKST();
 return <span className="db-date-picks" role="group" aria-label={`${label} 바로 넣기`}>{picks.map(([text,shift])=>{const iso=shiftISODate(today,shift);return <button key={text} type="button" aria-pressed={value===iso} title={iso} onClick={e=>{e.preventDefault();onPick(iso);}}>{text}</button>;})}{onClear&&value&&<button type="button" className="db-date-clear" aria-label={`${label} 지우기`} onClick={e=>{e.preventDefault();onClear();}}>지우기</button>}</span>;
}
