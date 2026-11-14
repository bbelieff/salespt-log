/**
 * 일정·계약 탭 (PR 03 / Phase 2).
 * 정본: docs/design/prototypes/schedule-weekly.html
 *
 * 흐름:
 *   - useWeekMeetings(weekStart) → ScheduleWeekView (7일 미팅, 미팅날짜 기준)
 *   - 카드 클릭 → 펼침 → 액션 선택(계약/완료/변경/취소) → 폼 입력 → 확정
 *   - 계약/완료/취소: usePatchMeeting → invalidate week-key
 *   - 변경: useAppendMeeting(새 미팅) + usePatchMeeting(원본=변경) 순차 → invalidate week
 */
"use client";

import AppToast from "@/components/ui/AppToast";
import DeletedMeetings from "@/components/meeting-safety/DeletedMeetings";
import { useMeetingDeleteConfirm } from "@/components/meeting-safety/use-meeting-delete-confirm";
import PageContainer from "@/components/PageContainer";
import WeekBody from "./_components/WeekBody";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Meeting } from "@/types";
import { useWeekMeetings } from "@/query/contact-hooks";
import { useManualLinkPrompt } from "./_lib/use-manual-link-prompt";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useGuardedNav } from "@/components/DirtyGuard";
import WeekHeader from "./_components/WeekHeader";
import SummaryBar from "./_components/SummaryBar";
import DaySection from "./_components/DaySection";
import WeekFallback from "./_components/WeekFallback";
import TopHeader from "@/components/TopHeader";
import FirstStepTourOffer from "@/components/onboarding/FirstStepTourOffer";
import { addDays, fmtISO, friOf, parseISO, weekIndexOf } from "./_lib/week";
import { useWeekStartSync } from "./_lib/useWeekStartSync";
import { useMeetingActions } from "./_lib/useMeetingActions";
import { useMeetingPatch } from "./_lib/useMeetingPatch";
import { useBoardView } from "./_lib/useBoardView";
import MeetingResultCard from "./_components/MeetingResultCard";
import WeekBoard from "./_components/board/WeekBoard";
import ViewSwitch from "./_components/board/ViewSwitch";
import BoardMeetingPop from "./_components/board/BoardMeetingPop";
import { useMobileExtras } from "./_components/board/useMobileExtras";

const TODAY_ISO = fmtISO(new Date());

export default function SchedulePage() {
  const deleteConfirm=useMeetingDeleteConfirm();
  const router = useRouter();
  // weekStart 초기값=오늘. 동기화(?date= 우선 / 없으면 today 주차 정렬)는
  // useWeekStartSync 훅이 담당. 서버는 input weekStart 를 그대로 사용.
  const [weekStart, setWeekStart] = useState<string>(TODAY_ISO);

  // 보이는 7일: 금~목은 수강 주(weekStart) 그대로, 월~일은 그 안의 월요일부터. PC(1280px+)는 주간 보드.
  const { order, setOrder, viewStart, isBoard } = useBoardView(weekStart);
  const weekQuery = useWeekMeetings(viewStart);
  const manualLink = useManualLinkPrompt(); // 같은 이름 「영업기록 없이 추가」 업체 → 연결 제안
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const dayRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 캘린더 → ?focus=<meetingId> → 그 카드 스크롤+하이라이트. window.location 직접 파싱(Suspense 회피).
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("focus");
    if (f) setFocusId(f);
  }, []);

  // weekStart 동기화: ?date= 우선(그 주차로 잠금), 없으면 today 주차로 정렬.
  useWeekStartSync(
    weekStart,
    setWeekStart,
    weekQuery.data?.courseStart,
    TODAY_ISO,
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  // 미팅 저장(계약 장부 연결 포함) — 캘린더 한 달 보드와 같은 함수(./_lib/useMeetingPatch.ts, decideContractFanout).
  const handlePatch = useMeetingPatch({
    weekStart: viewStart, setPendingId, showToast, manualLink,
    findMeeting: (id) => weekQuery.data?.daysByMeetingDate.flatMap((d) => d.meetings).find((m) => m.id === id),
  });

  const mobile = useMobileExtras({ enabled: !isBoard, viewStart, courseWeekFri: fmtISO(friOf(parseISO(weekStart))), toast: showToast });
  const { handleReschedule, handleRevert, handleAddMeeting, handleDelete, handleReviveCase } =
    useMeetingActions({ weekStart: viewStart, setPendingId, showToast, deleteConfirm });

  /** 2026-05-18 [2]: 주차 슬라이드 방향 — 다음 주(right) / 이전 주(left). 220ms 후 reset. */
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);

  // 주차 이동도 미저장 가드(결과 폼 dirty 면 모달). 버튼·스와이프 모두 이 함수 경유.
  const guardedNav = useGuardedNav();
  const moveWeek = (delta: number) =>
    guardedNav(() => {
      setSlideDir(delta > 0 ? "right" : "left");
      const cur = parseISO(weekStart);
      setWeekStart(fmtISO(addDays(cur, delta * 7)));
      setTimeout(() => setSlideDir(null), 260);
    });

  // 2026-05-17 [A3]: 좌우 스와이프로 주 이동.
  const weekSwipe = useSwipe({
    onSwipeLeft: () => moveWeek(1),
    onSwipeRight: () => moveWeek(-1),
  });

  // 날짜 클릭 스크롤 — 전 요일 sticky 헤더 아래(block:start) 정렬. scroll-mt-[280px]는 ref wrapper(아래)에 둬야 헤더 안 가림(이전 idx 분기+scroll-margin 누락 버그).
  const scrollToDay = (idx: number) => {
    const el = dayRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 메모: 모든 미팅 평탄화 (요약 바 입력)
  const allMeetings = useMemo(() => {
    if (!weekQuery.data) return [] as Meeting[];
    return weekQuery.data.daysByMeetingDate.flatMap((d) => d.meetings);
  }, [weekQuery.data]);

  // 2026-05-19: 추가미팅 자식 추적 — previousMeetingId 매칭 set.
  // 원본 카드가 "케이스 종료" 표시되어야 하는지 판단용.
  const followUpParentIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMeetings) {
      if (m.previousMeetingId) set.add(m.previousMeetingId);
    }
    return set;
  }, [allMeetings]);

  const countsByDay = useMemo(() => {
    if (!weekQuery.data) return Array(7).fill(0) as number[];
    return weekQuery.data.daysByMeetingDate.map((d) => d.meetings.length);
  }, [weekQuery.data]);

  if (weekQuery.isLoading || weekQuery.isError) {
    return (
      <WeekFallback
        state={weekQuery.isError ? "error" : "loading"}
        onRetry={() => weekQuery.refetch()}
        retrying={weekQuery.isFetching}
      />
    );
  }
  if (!weekQuery.data) return null;

  const { courseStart: courseStartISO, daysByMeetingDate } = weekQuery.data;
  // weekIndex는 UI 기준(Fri-Thu)으로 재계산 — 백엔드는 courseStart-DOW 기준이라
  // UI 표시용으로 일관성 위해 재계산.
  const weekIndex = weekIndexOf(
    parseISO(weekStart),
    parseISO(courseStartISO),
  );

  const renderDay = (
    day: (typeof daysByMeetingDate)[number],
    globalIndex: number,
  ) => (
    <div
      key={day.date}
      className="scroll-mt-[280px]"
      ref={(el) => {
        dayRefs.current[globalIndex] = el;
      }}
    >
      <DaySection
        date={day.date}
        meetings={day.meetings}
        todayISO={TODAY_ISO}
        pendingId={pendingId}
        focusId={focusId}
        onPatch={handlePatch}
        onReschedule={handleReschedule}
        onRevert={handleRevert}
        onAddMeeting={handleAddMeeting}
        onDelete={handleDelete}
        followUpParentIds={followUpParentIds}
        onReviveCase={handleReviveCase}
        extra={mobile.dayExtra(day.date)}
      />
    </div>
  );

  if (isBoard) {
    return (
      <>
        {deleteConfirm.element}
        <TopHeader pageEmoji="📋" pageTitle="일정·계약" />
        <WeekBoard courseWeekFri={fmtISO(friOf(parseISO(weekStart)))} viewStart={viewStart} courseStart={courseStartISO} order={order}
          meetings={allMeetings} todayISO={TODAY_ISO} focusId={focusId} toast={showToast} extra={<DeletedMeetings />}
          onPrev={() => moveWeek(-1)} onNext={() => moveWeek(1)} onOrder={setOrder}
          onToday={() => guardedNav(() => setWeekStart(fmtISO(friOf(parseISO(TODAY_ISO)))))}
          onMonth={(date) => guardedNav(() => router.push(`/calendar?date=${date}`))}
          renderMeeting={(m) => (
            <BoardMeetingPop key={m.id} meeting={m} pending={pendingId === m.id}
              onPatch={(partial, opts) => handlePatch(m.id, partial, opts)} onReschedule={(d, t, r) => handleReschedule(m, d, t, r)}
              onRevert={() => handleRevert(m.id)} onAddMeeting={(d, t) => handleAddMeeting(m, d, t)} onDelete={() => handleDelete(m)}
              hasFollowUp={followUpParentIds.has(m.id)} onReviveCase={() => handleReviveCase(m)} />
          )} />
        {toast && <AppToast>{toast}</AppToast>}
        {manualLink.element}
      </>
    );
  }

  return (
    <>
      {deleteConfirm.element}
      <div className="mx-auto flex w-full justify-end px-4 py-2"><DeletedMeetings /></div>
      {/* 폰·태블릿 페이지 띠 오른쪽 「주 | 월」 — 「월」은 캘린더(월 보기)로, 보이는 주의 날짜를 지닌 채. */}
      <TopHeader pageEmoji="📋" pageTitle="일정·계약" pageNavigation={
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-slate-700 sm:gap-2">
          <span aria-hidden="true" className="shrink-0 text-base leading-none">📋</span><span className="truncate">일정·계약</span>
          <ViewSwitch view="week" className="ml-auto" onView={() => guardedNav(() => router.push(`/calendar?date=${TODAY_ISO >= viewStart && TODAY_ISO <= fmtISO(addDays(parseISO(viewStart), 6)) ? TODAY_ISO : fmtISO(addDays(parseISO(viewStart), 3))}`))} />
        </div>
      } />
      {/* WeekHeader + SummaryBar 를 하나의 sticky 컨테이너로 묶어 drift 방지.
          (이전: 각자 sticky → top 값 추정에 의존하여 살짝 흔들림) */}
      <div className="sticky top-app-content z-30 bg-white shadow-sm" {...weekSwipe}>
        {/* sticky 배경은 전폭, 주차·실적 요약만 풀사이즈에서 중앙 50% */}
        <PageContainer width="fluid">
          <div className="min-[1440px]:mx-auto min-[1440px]:w-1/2">
            <WeekHeader
              weekIndex={weekIndex}
              weekStart={viewStart}
              todayISO={TODAY_ISO}
              countsByDay={countsByDay}
              onPrevWeek={() => moveWeek(-1)}
              onNextWeek={() => moveWeek(1)}
              onClickDay={scrollToDay}
              slideDir={slideDir}
            />
            <SummaryBar meetings={allMeetings} goalSummary={<WeeklyGoalSummary compact date={weekStart} metrics={["meetings", "contracts"]} />} />
          </div>
        </PageContainer>
      </div>

      <PageContainer width="fluid"><div className="px-4 pt-3 pc:px-0">
        {mobile.issuesPanel}
        <FirstStepTourOffer tour="result" available={allMeetings.some((m) => m.상태 === "예약" || m.상태 === "변경")}
          alreadyDone={allMeetings.some((m) => m.상태 === "계약" || m.상태 === "완료")} />
      </div></PageContainer>
      <WeekBody
        firstDays={daysByMeetingDate.slice(0, 3).map((day, j) => renderDay(day, j))}
        lastDays={daysByMeetingDate.slice(3).map((day, j) => renderDay(day, j + 3))} />

      {mobile.sheets}
      {toast && (
        <AppToast>{toast}</AppToast>
      )}
      {manualLink.element}
    </>
  );
}
