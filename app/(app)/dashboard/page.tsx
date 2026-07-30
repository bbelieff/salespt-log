/**
 * 대시보드 페이지 (`/dashboard`).
 * 정본: docs/handoff/inbox/dashboard-2026-05-07/dashboard-prototype.html
 * SSOT: docs/design/components.md §9 + §8 (대시보드 변형 헤더)
 *
 * 구조:
 *   TopHeader (5탭 동일)
 *     ├─ 슬림 바 (top-0 z-50)
 *     └─ PageBanner (top-12 z-40, 📊 대시보드 / 코스 누적 부제)
 *   DashboardProgressBanner (top-24 z-30 sticky) — 진행도 + 매출/비용
 *   본문 (`<main>` p-4 space-y-4):
 *     - OperatingProfitCard (별도 큰 카드, KPI 강조)
 *     - FunnelChart (6단계 stacked + 사다리꼴 connector)
 *     - ProductivityIndicators (4지표, indigo gradient)
 *     - WeeklyDualChart (코스 주차 추이 — STATS_WEEKS)
 *     - ChannelCostDonut (3채널 + 콜·지·기·소 별도)
 *
 * me.data 없어도 dash.data 만으로 본문 섹션은 렌더 — 배너만 me 필요(더미 fallback 제거, R4 W1-3).
 */
"use client";
import PageContainer from "@/components/PageContainer";

import { useMemo, useState } from "react";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { parseISO, weekIndexOf } from "@/util/week";
import TopHeader from "@/components/TopHeader";
import { useMe } from "@/query/me-hook";
import TrainerPlayerToggle from "@/components/auth/TrainerPlayerToggle";
import { useDashboard } from "@/query/dashboard-hooks";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import OperatingProfitCard from "@/components/dashboard/OperatingProfitCard";
import FunnelChart from "@/components/dashboard/FunnelChart";
import ProductivityIndicators from "@/components/dashboard/ProductivityIndicators";
import WeeklyDualChart from "@/components/dashboard/WeeklyDualChart";
import ChannelPerformance from "@/components/dashboard/ChannelPerformance";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";

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
  const [expenseLedgerOpen, setExpenseLedgerOpen] = useState(false);
  const me = useMe();
  const dash = useDashboard();

  const today = todayISO();

  // 진행도 라벨 — 더미 날짜 fallback 은 G5 가드 위반이라 제거(R4 W1-3).
  // ⚠️ 날짜가 없어도 **배너 자체는 렌더**한다(hasDates=false 로 진행도 줄만 숨김) — me 시트 read 가
  // 실패해도(200+빈문자열 강등, me.ts) 매출/비용과 **경비장부 유일 진입점**은 살아있어야 한다(적대리뷰 MAJOR).
  const banner = useMemo(() => {
    const courseStart = me.data?.courseStartISO;
    const graduation = me.data?.graduationISO;
    if (!courseStart || !graduation) return { hasDates: false as const };
    const elapsed = daysBetween(courseStart, today);
    const total = daysBetween(courseStart, graduation); // O2−O1 (7기+ 50일)
    // 주차 앵커 = weekIndexOf 정본(시작일, lib/util/week.ts).
    // 코스주차 = 통계 창 1~STATS_WEEKS clamp / 수료 = 종강일(O2) 경과 — 주차 산술 아님(8주차 도중 종강 가능).
    const actualWeek = weekIndexOf(parseISO(today), parseISO(courseStart));
    const courseWeek = Math.max(1, Math.min(STATS_WEEKS, actualWeek));
    const graduated = daysBetween(graduation, today) > 0;
    const progressPercent = Math.max(0, Math.min(100, (elapsed / total) * 100));
    const weekday = KO_DAY[new Date(today + "T00:00").getDay()] ?? "";
    return {
      hasDates: true as const,
      today: fmtMD(today),
      weekday,
      currentWeek: courseWeek,
      graduated,
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
      <TopHeader pageEmoji="📊" pageTitle="대시보드" pageSubtitle={`${STATS_WEEKS}주 누적`} />

      {/* 수강생출신 트레이너 self-view 중 — 트레이너 관리로 복귀 토글(P14). */}
      {me.data?.ownArenaSheetId && (
        <div className="px-4 pt-3">
          <TrainerPlayerToggle mode="arena" />
        </div>
      )}

      {/* 에러 안내 — 500/404 에 무안내 빈 화면이던 부수결함 수리 (P1, 2026-07-28) */}
      {dash.isError && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-center">
            <p className="text-sm font-bold text-red-700">
              {dash.error instanceof Error && dash.error.message === "no_sheet"
                ? "이 계정은 개인 일지 시트가 없어요"
                : "데이터를 불러오지 못했어요"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-600">
              {dash.error instanceof Error && dash.error.message === "no_sheet"
                ? "트레이너·미등록 계정은 대시보드를 볼 수 없어요. 관리 메뉴를 이용해 주세요."
                : "잠시 후 새로고침해 주세요. 계속되면 운영자에게 알려 주세요."}
            </p>
            {/* 탈출구 — R4 W1-2 로 시트 없는 등록 계정도 강등 없이 들어오게 됐다(루프 방지).
                그래서 이 카드가 종착지가 되면 안 된다: 기수 연결 화면으로 갈 길을 남긴다(적대리뷰 지적). */}
            {dash.error instanceof Error && dash.error.message === "no_sheet" && (
              <a
                href="/claim"
                className="mt-3 inline-block rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
              >
                내 기수에 계정 연결하기
              </a>
            )}
          </div>
        </div>
      )}

      {dash.data && (
        <DashboardProgressBanner
          hasDates={banner.hasDates}
          today={banner.hasDates ? banner.today : ""}
          weekday={banner.hasDates ? banner.weekday : ""}
          currentWeek={banner.hasDates ? banner.currentWeek : 0}
          graduated={banner.hasDates ? banner.graduated : false}
          startDate={banner.hasDates ? banner.startDate : ""}
          progressPercent={banner.hasDates ? banner.progressPercent : 0}
          graduationDate={banner.hasDates ? banner.graduationDate : ""}
          revenue={dash.data.kpi.총매출}
          cost={dash.data.kpi.총비용}
          // 실제 분해: 수임비합 + 수수료합 = 총매출 (수납탭과 일치).
          feeIncome={dash.data.kpi.수임비합}
          commissionIncome={dash.data.kpi.수수료합}
          dbCostTotal={dash.data.additionalCost.dbCostTotal}
          additionalCost={dash.data.additionalCost.status === "available" ? dash.data.additionalCost.additionalCost : null}
          onOpenExpenseLedger={() => setExpenseLedgerOpen(true)}
        />
      )}

      <div className="space-y-4 p-4">
        {/* 로딩은 전역 오버레이(LoadingProvider)가 자동 표시 — 수동 렌더 제거.
            에러 안내는 상단 카드 1곳으로 통합 (P1 2026-07-28 — 이중 표시·상충 문구 제거). */}
        {dash.data && (
          <>
            {/* 상단 2+1: 좌[영업이익(컴팩트)+생산성] / 우[퍼널(길게)].
                items-start 로 영업이익 카드가 퍼널 높이만큼 늘어나 비던 문제 해소. */}
            <div className="space-y-4 pc:grid pc:grid-cols-2 pc:items-start pc:gap-4 pc:space-y-0">
              <div className="space-y-4 pc:flex pc:flex-col pc:gap-4 pc:space-y-0">
                <OperatingProfitCard
                  revenue={dash.data.kpi.총매출}
                  cost={dash.data.kpi.총비용}
                  contractCount={contractCount}
                  carryoverRevenue={dash.data.kpi.이월매출}
                  totalRevenue={dash.data.kpi.전체매출}
                />
                <ProductivityIndicators matrix={dash.data.channelMatrix} />
              </div>
              <FunnelChart matrix={dash.data.channelMatrix} />
            </div>

            {/* 하단 2열: 8주차 추이 | 채널별 성과 */}
            <div className="space-y-4 pc:grid pc:grid-cols-2 pc:items-start pc:gap-4 pc:space-y-0">
              <WeeklyDualChart points={dash.data.weeklyTrend} />
              <ChannelPerformance
                costBreakdown={dash.data.costBreakdown}
                matrix={dash.data.channelMatrix}
              />
            </div>
          </>
        )}
      </div>
      {dash.data && (
        <ExpenseLedgerDialog
          open={expenseLedgerOpen}
          onClose={() => setExpenseLedgerOpen(false)}
          dbCostTotal={dash.data.additionalCost.dbCostTotal}
          additionalCost={dash.data.additionalCost.status === "available" ? dash.data.additionalCost.additionalCost : null}
        />
      )}
      </PageContainer>
    </main>
  );
}
