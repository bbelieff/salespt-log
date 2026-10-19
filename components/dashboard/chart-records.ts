import type {DashboardView} from '@/types';

/** 빈 차트만 접는다. 비용만 있거나 최근 기록 조회가 실패한 경우도 남겨 둔다. */
export function hasDashboardChartRecords(view: DashboardView): boolean {
  return view.weeklyTrendPeriod?.status === 'unavailable'
    || view.channelMatrix.some(row => [row.생산,row.유입,row.컨택진행,row.미팅예약,row.미팅완료,row.계약].some(value => value !== 0))
    || view.weeklyTrend.some(row => row.활동량 !== 0 || row.계약수 !== 0)
    || view.costBreakdown.some(row => row.비용 !== 0);
}
