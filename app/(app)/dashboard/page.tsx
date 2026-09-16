/** 대시보드: 공용 헤더 → 날짜/진행 sticky → 재무 3종 본문 → 분석/주간목표. SSOT: docs/design/components.md §8–9. */
"use client";
import PageContainer from "@/components/PageContainer";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";

import { useMemo, useState } from "react";
import { courseWeeksForCohort, courseEndISO, ceremonyISO, isExtendedCourseCohort } from "@/config/cohort-dates";
import { parseISO, todayKST, weekIndexOf } from "@/util/week";
import TopHeader from "@/components/TopHeader";
import { useMe } from "@/query/me-hook";
import { useDashboard } from "@/query/dashboard-hooks";
import DashboardProgressBanner from "@/components/dashboard/DashboardProgressBanner";
import FinanceSummaryBoxes from "@/components/dashboard/FinanceSummaryBoxes";
import FunnelChart from "@/components/dashboard/FunnelChart";
import ProductivityIndicators from "@/components/dashboard/ProductivityIndicators";
import WeeklyDualChart from "@/components/dashboard/WeeklyDualChart";
import ChannelPerformance from "@/components/dashboard/ChannelPerformance";
import ExpenseLedgerDialog from "@/components/dashboard/expense-ledger/ExpenseLedgerDialog";

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

  const today = todayKST();
  const weeks = courseWeeksForCohort(me.data?.cohort);

  // 진행도 라벨 — 더미 날짜 fallback 은 G5 가드 위반이라 제거(R4 W1-3).
  // ⚠️ 날짜가 없어도 **배너 자체는 렌더**한다(hasDates=false 로 진행도 줄만 숨김) — me 시트 read 가
  // 실패해도(200+빈문자열 강등, me.ts) 본문의 매출/비용과 경비장부 진입점은 유지한다.
  const banner = useMemo(() => {
    const courseStart = me.data?.courseStartISO;
    const ceremony = ceremonyISO(me.data?.courseStartISO ?? "", me.data?.cohort) || me.data?.graduationISO;
    const graduation = isExtendedCourseCohort(me.data?.cohort) ? courseEndISO(courseStart ?? "", me.data?.cohort) : ceremony;
    if (!courseStart || !graduation) return { hasDates: false as const };
    const elapsed = daysBetween(courseStart, today);
    const total = daysBetween(courseStart, graduation); // O2−O1 (7기+ 50일)
    // 주차 앵커 = weekIndexOf 정본(시작일, lib/util/week.ts).
    // 코스주차 = 통계 창 1~STATS_WEEKS clamp / 수료 = 종강일(O2) 경과 — 주차 산술 아님(8주차 도중 종강 가능).
    const actualWeek = weekIndexOf(parseISO(today), parseISO(courseStart));
    const courseWeek = Math.max(1, Math.min(weeks, actualWeek));
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
      graduationDate: fmtMD(ceremony || graduation),
      endISO: graduation,
    };
  }, [me.data, today, weeks]);

  // 계약 건수 (matrix.계약 합) — 영업이익 상세 패널 보조 텍스트
  const contractCount = useMemo(() => {
    if (!dash.data) return undefined;
    return dash.data.channelMatrix.reduce((s, m) => s + m.계약, 0);
  }, [dash.data]);

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <TopHeader pageEmoji="📊" pageTitle="대시보드" pageSubtitle={`${weeks}주 누적`} />

      <div className="sticky top-app-content z-30 bg-white" aria-label="오늘 날짜와 수강 진행">
        <PageContainer width="wide">
          <DashboardProgressBanner
            hasDates={banner.hasDates}
            today={fmtMD(today)}
            weekday={KO_DAY[new Date(today + "T00:00").getDay()] ?? ""}
            currentWeek={banner.hasDates ? banner.currentWeek : 0}
            graduated={banner.hasDates ? banner.graduated : false}
            startDate={banner.hasDates ? banner.startDate : ""}
            progressPercent={banner.hasDates ? banner.progressPercent : 0}
            graduationDate={banner.hasDates ? banner.graduationDate : ""}
            graduationISO={banner.hasDates ? banner.endISO : me.data?.graduationISO}
          />
        </PageContainer>
      </div>
      <PageContainer width="wide">

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
        {dash.data && (
          <>
            {/* [3] 매출·비용·영업이익 3열 1행 — 본문 상단, 진행도와 분리(별도 카드).
                상세(수임비·수수료/DB·추가비용/이익률·시즌·이월·전체)는 컬럼 클릭 시
                행 아래 공용 패널에 펼친다(SSOT: docs/design/components.md §9-2). */}
            <section aria-label="매출·비용·영업이익" className="rounded-2xl border border-slate-200 bg-slate-100 p-2">
              <FinanceSummaryBoxes
                revenue={dash.data.kpi.총매출}
                cost={dash.data.kpi.총비용}
                feeIncome={dash.data.kpi.수임비합}
                commissionIncome={dash.data.kpi.수수료합}
                dbCostTotal={dash.data.additionalCost.dbCostTotal}
                additionalCost={dash.data.additionalCost.status === "available" ? dash.data.additionalCost.additionalCost : null}
                onOpenExpenseLedger={() => setExpenseLedgerOpen(true)}
                weeks={weeks}
                contractCount={contractCount}
                carryoverRevenue={dash.data.kpi.이월매출}
                totalRevenue={dash.data.kpi.전체매출}
                carryoverCost={dash.data.kpi.이월비용}
                totalCost={dash.data.kpi.전체비용}
              />
            </section>

            {/* 좌측 두 카드와 우측 퍼널의 위아래 끝을 맞춘다. */}
            <div className="space-y-3 pc:grid pc:grid-cols-2 pc:items-stretch pc:gap-3 pc:space-y-0">
              <div className="space-y-3 pc:flex pc:flex-col pc:gap-3 pc:space-y-0">
                <ProductivityIndicators weeks={weeks} matrix={dash.data.channelMatrix} />
                <WeeklyGoalSummary className="pc:flex-1" />
              </div>
              <FunnelChart weeks={weeks} matrix={dash.data.channelMatrix} />
            </div>

            {/* 하단 2열: 8주차 추이 | 채널별 성과 */}
            <div className="space-y-3 pc:grid pc:grid-cols-2 pc:items-start pc:gap-3 pc:space-y-0">
              <WeeklyDualChart points={dash.data.weeklyTrend} />
              <ChannelPerformance weeks={weeks}
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
