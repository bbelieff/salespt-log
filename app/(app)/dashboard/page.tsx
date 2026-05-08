/**
 * 대시보드 페이지 (`/dashboard`).
 * 정본: docs/handoff/inbox/dashboard-2026-05-07/dashboard-prototype.html
 * SSOT: docs/design/components.md §9 + §8 (대시보드 변형 헤더)
 *
 * 구조:
 *   TopHeader (5탭 동일)
 *     ├─ 슬림 바 (top-0 z-50, ④ 자리에 자기 페이지 라벨)
 *     └─ PageBanner (top-12 z-40, 📊 대시보드)
 *   DashboardProgressBanner (top-24 z-30 sticky)
 *   본문:
 *     - FunnelChart (6단계)
 *     - ProductivityIndicators (4지표)
 *     - WeeklyDualChart (8주차)
 *     - ChannelCostDonut (3채널 + 콜·지·기·소)
 */
"use client";

import { useMemo } from "react";
import TopHeader from "@/components/TopHeader";
import { useMe } from "@/query/me-hook";
import { useDashboard } from "@/query/dashboard-hooks";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import FunnelChart from "@/components/dashboard/FunnelChart";
import ProductivityIndicators from "@/components/dashboard/ProductivityIndicators";
import WeeklyDualChart from "@/components/dashboard/WeeklyDualChart";
import ChannelCostDonut from "@/components/dashboard/ChannelCostDonut";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMD(iso: string): string {
  // YYYY-MM-DD → "M/D"
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

  // 주차 / 진행률 / 종강총회 라벨 계산 (data-model.md 공식)
  const banner = useMemo(() => {
    const courseStart = me.data?.courseStartISO;
    const graduation = me.data?.graduationISO;
    if (!courseStart || !graduation) return null;
    const elapsed = daysBetween(courseStart, today);
    const total = daysBetween(courseStart, graduation); // 57
    const currentWeek = Math.max(1, Math.min(8, Math.floor(elapsed / 7) + 1));
    const progressPercent = Math.max(0, Math.min(100, (elapsed / total) * 100));
    const weekday = KO_DAY[new Date(today + "T00:00").getDay()] ?? "";
    return {
      today: fmtMD(today),
      weekday,
      currentWeek,
      progressPercent,
      graduationDate: fmtMD(graduation),
    };
  }, [me.data, today]);

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <TopHeader pageEmoji="📊" pageTitle="대시보드" pageSubtitle="8주 누적" />

      {dash.data && banner && me.data && (
        <DashboardProgressBanner
          cohort={me.data.cohort}
          today={banner.today}
          weekday={banner.weekday}
          currentWeek={banner.currentWeek}
          progressPercent={banner.progressPercent}
          graduationDate={banner.graduationDate}
          revenue={dash.data.kpi.총매출}
          cost={dash.data.kpi.총비용}
          // 수임비/수수료는 시트 디스커버리 후 별도 매핑. 임시: 매출의 67%를 수임비, 33%를 수수료
          feeIncome={Math.round(dash.data.kpi.총매출 * 0.67)}
          commissionIncome={Math.round(dash.data.kpi.총매출 * 0.33)}
        />
      )}

      <div className="space-y-3 p-3">
        {dash.isLoading && (
          <div className="rounded-md bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
            대시보드 데이터 로딩 중…
          </div>
        )}
        {dash.isError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            대시보드 데이터 로딩 실패: {String(dash.error)}
          </div>
        )}
        {dash.data && (
          <>
            <FunnelChart matrix={dash.data.channelMatrix} />
            <ProductivityIndicators matrix={dash.data.channelMatrix} />
            <WeeklyDualChart points={dash.data.weeklyTrend} />
            <ChannelCostDonut
              breakdown={dash.data.costBreakdown}
              콜지기소수임비={dash.data.콜지기소수임비}
            />
          </>
        )}
      </div>
    </main>
  );
}
