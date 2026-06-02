/**
 * 대시보드 페이지 (`/dashboard`).
 * 정본: docs/handoff/inbox/dashboard-2026-05-07/dashboard-prototype.html
 * SSOT: docs/design/components.md §9 + §8 (대시보드 변형 헤더)
 *
 * 구조:
 *   TopHeader (5탭 동일)
 *     ├─ 슬림 바 (top-0 z-50)
 *     └─ PageBanner (top-12 z-40, 📊 대시보드 / 8주 누적)
 *   DashboardProgressBanner (top-24 z-30 sticky) — 진행도 + 매출/비용
 *   본문 (`<main>` p-4 space-y-4):
 *     - OperatingProfitCard (별도 큰 카드, KPI 강조)
 *     - FunnelChart (6단계 stacked + 사다리꼴 connector)
 *     - ProductivityIndicators (4지표, indigo gradient)
 *     - WeeklyDualChart (8주차)
 *     - ChannelCostDonut (3채널 + 콜·지·기·소 별도)
 *
 * me.data 없어도 dash.data 만으로 모든 섹션 렌더 (배너만 fallback 처리).
 */
"use client";
import PageContainer from "@/components/PageContainer";

import { useMemo } from "react";
import TopHeader from "@/components/TopHeader";
import { useMe } from "@/query/me-hook";
import { useDashboard } from "@/query/dashboard-hooks";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import OperatingProfitCard from "@/components/dashboard/OperatingProfitCard";
import FunnelChart from "@/components/dashboard/FunnelChart";
import ProductivityIndicators from "@/components/dashboard/ProductivityIndicators";
import WeeklyDualChart from "@/components/dashboard/WeeklyDualChart";
import ChannelPerformance from "@/components/dashboard/ChannelPerformance";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMD(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return `${m}/${d}`;
}

const KO_DAY = ["일", "월", "화", "수", "목", "금", "토"];

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toISO.split("-").map(Number) as [number, number, number];
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

export default function DashboardPage() {
  const me = useMe();
  const dash = useDashboard();

  const today = todayISO();

  // 진행도 라벨 — me 없으면 prototype 더미(6기 5/4) fallback
  const banner = useMemo(() => {
    const courseStart = me.data?.courseStartISO ?? "2026-04-10";
    const graduation = me.data?.graduationISO ?? "2026-06-06";
    const elapsed = daysBetween(courseStart, today);
    const total = daysBetween(courseStart, graduation); // 57 기대
    const currentWeek = Math.max(1, Math.min(8, Math.floor(elapsed / 7) + 1));
    const progressPercent = Math.max(0, Math.min(100, (elapsed / total) * 100));
    const weekday = KO_DAY[new Date(today + "T00:00").getDay()] ?? "";
    return {
      today: fmtMD(today),
      weekday,
      currentWeek,
      startDate: fmtMD(courseStart),
      progressPercent,
      graduationDate: fmtMD(graduation),
    };
  }, [me.data, today]);

  // 계약 건수 (matrix.계약 합) — OperatingProfitCard 보조 텍스트
  const contractCount = useMemo(() => {
    if (!dash.data) return undefined;
    return dash.data.channelMatrix.reduce((s, m) => s + m.계약, 0);
  }, [dash.data]);

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <PageContainer width="wide">
      <TopHeader pageEmoji="📊" pageTitle="대시보드" pageSubtitle="8주 누적" />

      {dash.data && (
        <DashboardProgressBanner
          today={banner.today}
          weekday={banner.weekday}
          currentWeek={banner.currentWeek}
          startDate={banner.startDate}
          progressPercent={banner.progressPercent}
          graduationDate={banner.graduationDate}
          revenue={dash.data.kpi.총매출}
          cost={dash.data.kpi.총비용}
          // 수임비/수수료는 시트 디스커버리 후 별도 매핑. 임시: 67/33 분할
          feeIncome={Math.round(dash.data.kpi.총매출 * 0.67)}
          commissionIncome={Math.round(dash.data.kpi.총매출 * 0.33)}
        />
      )}

      <div className="space-y-4 p-4 pc:grid pc:grid-cols-2 pc:gap-4 pc:space-y-0">
        {dash.isLoading && (
          <div className="rounded-md bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
            대시보드를 불러오고 있어요
          </div>
        )}
        {dash.isError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            대시보드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        )}
        {dash.data && (
          <>
            <OperatingProfitCard
              revenue={dash.data.kpi.총매출}
              cost={dash.data.kpi.총비용}
              contractCount={contractCount}
            />
            <FunnelChart matrix={dash.data.channelMatrix} />
            <ProductivityIndicators matrix={dash.data.channelMatrix} />
            <WeeklyDualChart points={dash.data.weeklyTrend} />
            <ChannelPerformance
              costBreakdown={dash.data.costBreakdown}
              matrix={dash.data.channelMatrix}
            />
          </>
        )}
      </div>
      </PageContainer>
    </main>
  );
}
