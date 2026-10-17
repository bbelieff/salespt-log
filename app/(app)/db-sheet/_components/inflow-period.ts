import {periodBounds,type DateRange,type FinancePeriod} from '@/util/finance-period';
import {isValidISODate,todayKST} from '@/util/week';

export type InflowPeriodId = FinancePeriod | 'today';

/** 실무/수납과 같은 월~일 기간. 오늘은 기기 시간대가 아닌 KST 기준. */
export function inflowPeriodBounds(period:InflowPeriodId,from:string,to:string,today=todayKST()):DateRange {
 if(period==='today')return [today,today];
 if(period==='custom'&&(!isValidISODate(from)||!isValidISODate(to)))return null;
 return periodBounds(period,from,to,today);
}
