"use client";
import PeriodPicker from '@/components/ui/PeriodPicker';
import {inflowPeriodBounds,type InflowPeriodId} from './inflow-period';

type Props={period:InflowPeriodId;from:string;to:string;onPeriod:(value:InflowPeriodId)=>void;onFrom:(value:string)=>void;onTo:(value:string)=>void};

/** 공유 기간 컴포넌트에 DB 유입일의 '오늘' 선택만 더한다. 선택 상태는 페이지가 소유해 초기화도 동기화한다. */
export function InflowPeriod({period,from,to,onPeriod,onFrom,onTo}:Props){
 const incomplete=period==='custom'&&!inflowPeriodBounds(period,from,to);
 return <div className="sheet-inflow-period" role="group" aria-label="유입일 기간">
  <span>유입일</span>
  <button type="button" aria-pressed={period==='today'} onClick={()=>onPeriod('today')} className="h-7 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-500">오늘</button>
  <PeriodPicker period={period} from={from} to={to} onPeriod={onPeriod} onFrom={onFrom} onTo={onTo} labels={{custom:'범위 지정'}}/>
  {incomplete&&<small role="status">시작일·종료일을 확인해 주세요. 현재 전체 기간을 표시합니다.</small>}
 </div>;
}
