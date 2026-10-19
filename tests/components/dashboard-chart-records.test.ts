import {describe,it,expect} from 'vitest';
import {hasDashboardChartRecords} from '@/components/dashboard/chart-records';
import type {DashboardView} from '@/types';
const empty={channelMatrix:[],weeklyTrend:[],costBreakdown:[]} as unknown as DashboardView;
describe('empty dashboard chart replacement',()=>{
 it('collapses only truly empty charts',()=>{expect(hasDashboardChartRecords(empty)).toBe(false);});
 it('keeps cost-only, negative cost, recent activity and a failed lookup visible',()=>{
  expect(hasDashboardChartRecords({...empty,costBreakdown:[{채널:'매입DB',비용:100}]})).toBe(true);
  expect(hasDashboardChartRecords({...empty,costBreakdown:[{채널:'매입DB',비용:-100}]})).toBe(true);
  expect(hasDashboardChartRecords({...empty,weeklyTrend:[{주차:1,활동량:2,계약수:0}]})).toBe(true);
  expect(hasDashboardChartRecords({...empty,weeklyTrendPeriod:{kind:'recent',startISO:'2026-01-02',endISO:'2026-02-20',status:'unavailable'}})).toBe(true);
 });
});
