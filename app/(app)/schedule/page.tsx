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

import PageContainer from "@/components/PageContainer";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Meeting } from "@/types";
import {
  useAppendMeeting,
  usePatchMeeting,
  useRemoveMeeting,
  useRevertMeeting,
  useReviveCaseClosure,
  useWeekMeetings,
} from "@/query/contact-hooks";
import {
  useAddContractPayment,
  useSyncContractFee,
} from "@/query/contract-payment-hooks";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useGuardedNav } from "@/components/DirtyGuard";
import { decideContractFanout } from "./_lib/contract-fanout";
import WeekHeader from "./_components/WeekHeader";
import SummaryBar from "./_components/SummaryBar";
import DaySection from "./_components/DaySection";
import WeekFallback from "./_components/WeekFallback";
import TopHeader from "@/components/TopHeader";
import { addDays, fmtISO, parseISO, weekIndexOf } from "./_lib/week";
import { useWeekStartSync } from "./_lib/useWeekStartSync";
import { formatMoney } from "@/lib/format/money";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TODAY_ISO = fmtISO(new Date());

export default function SchedulePage() {
  // weekStart 초기값=오늘. 동기화(?date= 우선 / 없으면 today 주차 정렬)는
  // useWeekStartSync 훅이 담당. 서버는 input weekStart 를 그대로 사용.
  const [weekStart, setWeekStart] = useState<string>(TODAY_ISO);

  const weekQuery = useWeekMeetings(weekStart);
  const patchMeeting = usePatchMeeting();
  const appendMeeting = useAppendMeeting();
  const removeMeeting = useRemoveMeeting();
  const revertMeeting = useRevertMeeting();
  const reviveCaseClosure = useReviveCaseClosure();
  const addContractPayment = useAddContractPayment();
  const syncContractFee = useSyncContractFee();
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

  const handlePatch = async (
    id: string,
    partial: Partial<Omit<Meeting, "id">>,
  ) => {
    setPendingId(id);
    try {
      // patch 전에 현재 미팅 상태를 lookup — fan-out 중복 방지에 필요.
      // (예약→계약 전환에만 새 row 생성, 계약→계약 수정 시는 skip)
      const prevMeeting = weekQuery.data?.daysByMeetingDate
        .flatMap((d) => d.meetings)
        .find((m) => m.id === id);
      const wasAlreadyContract = prevMeeting?.상태 === "계약";

      await patchMeeting.mutateAsync({
        date: "", // 일정·계약 탭에선 day-key 무관
        weekStart,
        id,
        partial,
      });

      // Fan-out: 계약 저장 시 02 장부 행 보장. ⚠️ 매출이 사라졌던 자리다
      // (2026-09-01 · 10기 문병규 ₩1,100,000). 규칙·근거 = ./_lib/contract-fanout.ts
      const fanout = decideContractFanout(partial, prevMeeting);
      if (fanout.kind === "blocked") {
        showToast(
          "⚠ 계약 상태는 저장됐지만 계약 정보를 읽지 못해 장부에 넣지 못했어요. 새로고침 후 이 카드를 다시 계약으로 저장해 주세요.",
        );
        return;
      }
      if (fanout.kind === "run") {
        const payload = fanout.payload;
        try {
          await addContractPayment.mutateAsync(payload);
          showToast("✓ 계약 확정 + 계약수납 row 생성됨");
        } catch {
          // 일시적 실패(네트워크·쿼터)로 매출이 사라지지 않게 한 번 더. 멱등이라 안전.
          try {
            await addContractPayment.mutateAsync(payload);
            showToast("✓ 계약 확정 + 계약수납 row 생성됨 (재시도 성공)");
          } catch (e) {
            showToast(
              `⚠ 계약 상태는 저장됐지만 장부에 넣지 못했어요: ${(e as Error).message} — 이 카드를 다시 계약으로 저장하면 채워져요.`,
            );
            return;
          }
        }
      } else if (
        wasAlreadyContract &&
        partial.수임비 !== undefined &&
        prevMeeting &&
        partial.수임비 !== prevMeeting.수임비
      ) {
        // 이미 계약 상태인 카드의 수임비가 변경된 경우 →
        // 02 계약수납관리 매칭 row(E열)도 sync update.
        try {
          const result = await syncContractFee.mutateAsync({
            계약일: prevMeeting.미팅날짜,
            업체명: prevMeeting.업체명,
            수임비: partial.수임비,
          });
          showToast(
            result.synced
              ? "✓ 저장 완료 + 계약수납 수임비 sync"
              : "✓ 저장 완료 (계약수납 매칭 row 없음 — 시트에서 수동 확인)",
          );
        } catch (e) {
          showToast(
            `⚠ 미팅은 저장됐으나 계약수납 sync 실패: ${(e as Error).message}`,
          );
        }
      } else {
        showToast("✓ 저장 완료");
      }
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 일정 변경 트랜잭션:
   *  1) 새 미팅 row append (id=uuid, 모든 필드 복사 + 새 미팅날짜/시간
   *     + 상태="예약" + previousMeetingId=원본 id)
   *  2) 원본 미팅 patch (상태="변경" + 미팅사유=변경사유)
   *
   * append 성공 후에만 patch 시도. patch 실패 시 안내(시트에 두 row 모두 "예약"
   * 상태로 남아있어 사용자 manual fix 필요).
   */
  const handleReschedule = async (
    original: Meeting,
    newDate: string,
    newTime: string,
    reason: string,
  ) => {
    setPendingId(original.id);
    const newId = uuid();
    // 변경 미팅은 업체명 앞에 "(변경) " prefix를 붙여 한눈에 식별 가능하게 함.
    // 이미 한 번 변경된 카드(이미 prefix 있음)는 중복 추가 방지.
    const prefixedName = original.업체명.startsWith("(변경)")
      ? original.업체명
      : `(변경) ${original.업체명}`;
    const newMeeting: Meeting = {
      ...original,
      id: newId,
      업체명: prefixedName,
      미팅날짜: newDate,
      미팅시간: newTime,
      상태: "예약",
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
      previousMeetingId: original.id,
      // 시트 수식 컬럼은 자동 — 보내지 않음
      표시상세: undefined,
      표시요약: undefined,
      계약합성라인: undefined,
      주차: undefined,
    };
    try {
      await appendMeeting.mutateAsync({
        date: original.예약일, // 컨택탭 day-key invalidate
        meeting: newMeeting,
      });
      try {
        // 미팅사유 누적: 기존이 있으면 회차 prefix 추가
        const prev = (original.미팅사유 ?? "").trim();
        const trimmed = reason.trim();
        const accumulated =
          !trimmed
            ? prev
            : !prev
              ? trimmed
              : `${prev}\n${prev.split("\n").length + 1}회차: ${trimmed}`;
        await patchMeeting.mutateAsync({
          date: "",
          weekStart,
          id: original.id,
          partial: { 상태: "변경", 미팅사유: accumulated },
        });
        showToast("✓ 일정 변경 완료");
      } catch (e) {
        showToast(
          `⚠ 새 미팅은 추가됐으나 원본 표시 실패: ${(e as Error).message} — 시트에서 직접 원본 행 J열 "변경"으로 수정 필요`,
        );
      }
    } catch (e) {
      showToast(`변경 실패 (새 미팅 추가 안 됨): ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 미팅 결과 되돌리기 (2026-05-17 [2a]).
   * 서버에서 상태별 cascade 처리 후 응답에서 cascade 요약 받아 토스트.
   */
  const handleRevert = async (id: string) => {
    setPendingId(id);
    try {
      const result = await revertMeeting.mutateAsync({ id, weekStart });
      showToast(`✓ 되돌림 (${result.status}) — ${result.cascade}`);
    } catch (e) {
      showToast(`되돌리기 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /**
   * 추가 미팅 (2026-05-17 [2b], 2026-05-19 갱신).
   * 완료/취소/계약 카드에서 같은 업체로 새 미팅 row append.
   * 채널/장소/예약비고 동일, 새 id, 상태=예약, **previousMeetingId=원본 id**.
   * → 원본 카드는 "케이스 종료" 표시 + 추가미팅 버튼 hide (자식 1건만 허용).
   */
  const handleAddMeeting = async (
    base: Meeting,
    newDate: string,
    newTime: string,
  ) => {
    setPendingId(base.id);
    const newId = uuid();
    // 업체명에서 "(변경)" prefix 가 있으면 제거 (추가 미팅은 변경 흐름 아님).
    const cleanVendor = base.업체명.replace(/^\(변경\)\s*/, "");
    const todayISO = fmtISO(new Date());
    const newMeeting: Meeting = {
      ...base,
      id: newId,
      예약일: todayISO,
      예약시각: new Date().toTimeString().slice(0, 5),
      업체명: cleanVendor,
      미팅날짜: newDate,
      미팅시간: newTime,
      상태: "예약",
      계약여부: false,
      수임비: 0,
      미팅사유: "",
      계약조건: "",
      previousMeetingId: base.id, // 2026-05-19: 원본 → 새 미팅 체인 (케이스 종료 표시)
      표시상세: undefined,
      표시요약: undefined,
      계약합성라인: undefined,
      주차: undefined,
    };
    try {
      await appendMeeting.mutateAsync({
        date: newMeeting.예약일,
        meeting: newMeeting,
      });
      showToast(`✓ 추가 미팅 생성: ${cleanVendor} ${newDate} ${newTime}`);
    } catch (e) {
      showToast(`추가 미팅 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /** 2026-05-18 [2]: 주차 슬라이드 방향 — 다음 주(right) / 이전 주(left). 220ms 후 reset. */
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);
  /**
   * 일정 삭제 (2026-05-19) — 컨택탭 cascade 와 동일.
   * confirm: "함께 사라지는 것" 명시. cascade: 계약카드 (있으면) + 미팅카드.
   */
  const handleDelete = async (meeting: Meeting) => {
    const hasContract = meeting.상태 === "계약";
    const extra = hasContract
      ? `\n· 수납탭 계약카드 1건 (₩${formatMoney(meeting.수임비)})`
      : "";
    if (
      !confirm(
        `'${meeting.업체명}' 미팅을 삭제할까요?\n\n함께 사라지는 것:\n· 일정탭 미팅카드 1건\n· 컨택탭 미팅예약 -1 (${meeting.channel})${extra}`,
      )
    )
      return;
    setPendingId(meeting.id);
    try {
      // DELETE 라우트가 cascade 처리 (PR #241). UI 측은 invalidate 만 의존.
      await removeMeeting.mutateAsync({
        date: meeting.예약일 || meeting.미팅날짜,
        id: meeting.id,
      });
      showToast(
        hasContract
          ? `✕ ${meeting.업체명} 미팅 + 계약카드 삭제`
          : `✕ ${meeting.업체명} 미팅 삭제`,
      );
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

  /** 케이스 종료 되살리기 (2026-05-19) — 자식 추가미팅 삭제. */
  const handleReviveCase = async (meeting: Meeting) => {
    if (
      !confirm(
        `'${meeting.업체명}' 케이스를 되살릴까요?\n\n자식 추가미팅 카드가 삭제됩니다 (계약 있었으면 계약카드도 함께 삭제).`,
      )
    )
      return;
    setPendingId(meeting.id);
    try {
      const result = await reviveCaseClosure.mutateAsync({
        id: meeting.id,
        weekStart,
      });
      showToast(`✓ 되살림 — ${result.cascade}`);
    } catch (e) {
      showToast(`되살리기 실패: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  };

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
      />
    </div>
  );

  return (
    <>
      <TopHeader
        pageEmoji="📋"
        pageTitle="일정·계약"
      />
      {/* WeekHeader + SummaryBar 를 하나의 sticky 컨테이너로 묶어 drift 방지.
          (이전: 각자 sticky → top 값 추정에 의존하여 살짝 흔들림) */}
      <div className="sticky top-24 z-30 bg-white shadow-sm" {...weekSwipe}>
        {/* 배경 full-bleed + 내용은 본문과 동일 6xl 중앙정렬 */}
        <PageContainer width="wide">
          <WeekHeader
            weekIndex={weekIndex}
            weekStart={weekStart}
            todayISO={TODAY_ISO}
            countsByDay={countsByDay}
            onPrevWeek={() => moveWeek(-1)}
            onNextWeek={() => moveWeek(1)}
            onClickDay={scrollToDay}
            slideDir={slideDir}
          />
          <SummaryBar meetings={allMeetings} />
        </PageContainer>
      </div>

      <main className="px-4 pb-[80px] pt-1">
      <PageContainer width="wide">
        {/* PC 2열(좌 금토일/우 월화수목) — gap-8 + 우 세로 구분선으로 좌우 분리 강화. 모바일 회귀 0. */}
        <div className="pc:grid pc:grid-cols-2 pc:items-start pc:gap-8">
          <div>
            {daysByMeetingDate.slice(0, 3).map((day, j) => renderDay(day, j))}
          </div>
          <div className="pc:border-l pc:border-gray-200 pc:pl-8">
            {daysByMeetingDate.slice(3).map((day, j) => renderDay(day, j + 3))}
          </div>
        </div>
      </PageContainer>
      </main>

      {toast && (
        <div className="fixed bottom-[80px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
