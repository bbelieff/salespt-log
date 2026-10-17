import {afterEach,describe,expect,it,vi} from 'vitest';
import {inflowPeriodBounds} from '@/app/(app)/db-sheet/_components/inflow-period';
import {filterDbSheetRows} from '@/app/(app)/db-sheet/_components/status-filter';

afterEach(()=>vi.useRealTimers());
describe('DB 유입 기간',()=>{
 it('한국 자정에 오늘 범위가 다음 날로 넘어간다',()=>{
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T14:59:59Z'));
  expect(inflowPeriodBounds('today','','')).toEqual(['2026-10-16','2026-10-16']);
  vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
  expect(inflowPeriodBounds('today','','')).toEqual(['2026-10-17','2026-10-17']);
 });
 it('이번 주는 월~일, 이번 달은 윤년과 말일을 포함한다',()=>{
  expect(inflowPeriodBounds('week','','','2028-01-02')).toEqual(['2027-12-27','2028-01-02']);
  expect(inflowPeriodBounds('month','','','2028-02-20')).toEqual(['2028-02-01','2028-02-29']);
 });
 it.each([['','2026-10-17'],['2026-10-17',''],['2026-10-18','2026-10-17'],['2026-02-30','2026-03-01']])('미완성·역순·없는 날짜 %s~%s는 전체 범위 안내 대상이다',(from,to)=>{
  expect(inflowPeriodBounds('custom',from,to)).toBeNull();
 });
 it('전체 초기화와 범위 양끝 포함을 실제 목록 필터에 적용한다',()=>{
  const rows=['2026-10-14','2026-10-15','2026-10-16','2026-10-17'].map(date=>({company:date,owner:'가상',phone:'',supplier:'공급처',date,result:'AS예정'}));
  const range=inflowPeriodBounds('custom','2026-10-15','2026-10-16')!;
  expect(filterDbSheetRows(rows,{from:range[0],to:range[1],selectedStatuses:['as-planned']}).map(row=>row.date)).toEqual(['2026-10-15','2026-10-16']);
  expect(inflowPeriodBounds('all',range[0],range[1])).toBeNull();
  expect(filterDbSheetRows(rows,{selectedStatuses:[]})).toHaveLength(4);
 });
});
