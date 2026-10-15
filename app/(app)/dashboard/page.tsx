/** 대시보드: 공용 헤더 → 날짜/진행 sticky → 재무 3종 본문 → 분석/주간목표. SSOT: docs/design/components.md §8–9. */
"use client";
import PageContainer from "@/components/PageContainer";
import DashboardActionOverview from "@/components/dashboard/DashboardActionOverview";
import "@/components/dashboard/dashboard-action-overview.css";

import { useMemo, useState } from "react";
import { courseWeeksForCohort } from "@/config/cohort-dates";
import { todayKST } from "@/util/week";
import { computeCourseBanner } from "./_lib/course-banner";
import TopHeader from "@/components/TopHeader";
import { useMe } from "@/query/me-hook";
import { useDashboard } from "@/query/dashboard-hooks";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import DashboardFinance from "@/components/dashboard/DashboardFinance";
import MobileChartCarousel from "@/components/dashboard/MobileChartCarousel";
import FunnelChart from "@/components/dashboard/FunnelChart";
import WeeklyDualChart from "@/components/dashboard/WeeklyDualChart";
import ChannelPerformance from "@/components/dashboard/ChannelPerformance";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

/** 모바일 차트 카드: 다음 카드가 살짝 보이는 폭 + 한 장씩 멈춤. PC 는 그리드 칸(폭 자동). */
const CHART_SLIDE = "min-w-0 shrink-0 basis-5/6 snap-start pc:shrink pc:basis-auto";
const CHART_LABELS = ["영업 퍼널", "주차 추이", "채널별 성과"] as const;

function fmtMD(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return `${m}/${d}`;
}

const KO_DAY = ["일", "월", "화", "수", "목", "금", "토"];

export default function DashboardPage() {
  const [expenseLedgerOpen, setExpenseLedgerOpen] = useState(false);
  const me = useMe();
  const dash = useDashboard();

  const today = todayKST();
  const weeks = courseWeeksForCohort(me.data?.cohort);

  // 진행도 라벨 — 더미 날짜 fallback 은 G5 가드 위반이라 제거(R4 W1-3).
  // ⚠️ 날짜가 없어도 **배너 자체는 렌더**한다(hasDates=false 로 진행도 줄만 숨김) — me 시트 read 가
  // 실패해도(200+빈문자열 강등, me.ts) 본문의 매출/비용과 경비장부 진입점은 유지한다.
  const banner = useMemo(() => {
    const b = computeCourseBanner({
      courseStartISO: me.data?.courseStartISO,
      graduationISO: me.data?.graduationISO,
      cohort: me.data?.cohort,
      todayISO: today,
      weeks,
    });
    if (!b.hasDates) return b;
    return { ...b, startDate: fmtMD(me.data?.courseStartISO ?? ""), graduationDate: fmtMD(b.endISO) };  }, [me.data, today, weeks]);

  // pc:min-h-0: short content must not force viewport height — the (app)
  // shell reserves no desktop tabbar space and page bottom padding stays small.
  return (
    <main className="min-h-screen bg-slate-50 pb-20 pc:min-h-0 pc:pb-6">
      <TopHeader pageEmoji="📊" pageTitle="대시보드" pageSubtitle={`${weeks}주 누적`} />

      <div className="sticky top-app-content z-30 bg-white" aria-label="오늘 날짜와 수강 진행">
        <PageContainer width="fluid">
          <DashboardProgressBanner
            hasDates={banner.hasDates}
            today={fmtMD(today)}
            weekday={KO_DAY[new Date(today + "T00:00").getDay()] ?? ""}
            currentWeek={banner.hasDates ? banner.currentWeek : 0}
            graduated={banner.hasDates ? banner.graduated : false}
            weeksAfterGraduation={banner.hasDates ? banner.weeksAfterGraduation : 0}
            startDate={banner.hasDates ? banner.startDate : ""}
            progressPercent={banner.hasDates ? banner.progressPercent : 0}
            graduationDate={banner.hasDates ? banner.graduationDate : ""}
            graduationISO={banner.hasDates ? banner.endISO : me.data?.graduationISO}
          />
        </PageContainer>
      </div>
      <PageContainer width="fluid">

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

      <div className="space-y-3 p-3">
        {/* 로딩은 전역 오버레이(LoadingProvider)가 자동 표시 — 수동 렌더 제거.
            에러 안내는 상단 카드 1곳으로 통합 (P1 2026-07-28 — 이중 표시·상충 문구 제거). */}
        {/* 불러오는 동안 카드 자리를 먼저 잡아 둔다(belie 2026-10-09). */}
        {!dash.data && !dash.isError && <DashboardSkeleton />}
        {dash.data && (
          <>
            {/* [3] 매출·비용·영업이익 3열 1행 + 기간 선택(전체·이번 달·이번 주·직접 설정).
                아레나 포함 여부와 상관없이 기간으로 집계한다(ADR-0034, 2026-10-08 belie).
                상세는 컬럼 클릭 시 행 아래 공용 패널(SSOT: docs/design/components.md §9-2). */}
            <DashboardFinance
              onOpenExpenseLedger={() => setExpenseLedgerOpen(true)}
              contractChannels={dash.data.contractChannels}
              onRefreshChannels={dash.refetch}
              channelsRefreshing={dash.isFetching}
            />

            <DashboardActionOverview matrix={dash.data.channelMatrix} weeks={weeks}
              todayISO={today} courseStartISO={me.data?.courseStartISO} />
            <div className="space-y-3 pc:grid pc:grid-cols-3 pc:items-stretch pc:gap-3 pc:space-y-0">
              {/* 1024 미만: 차트 3종을 옆으로 넘기는 카드(인터랙션 ②, 2026-10-09). PC 는 래퍼가 풀려 그리드 칸 그대로. */}
              <MobileChartCarousel labels={CHART_LABELS}>
                <div className={CHART_SLIDE}><FunnelChart weeks={weeks} matrix={dash.data.channelMatrix} /></div>
                <div className={CHART_SLIDE}><WeeklyDualChart points={dash.data.weeklyTrend} /></div>
                <div className={CHART_SLIDE}>
                  <ChannelPerformance weeks={weeks}
                    costBreakdown={dash.data.costBreakdown}
                    matrix={dash.data.channelMatrix}
                  />
                </div>
              </MobileChartCarousel>
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
