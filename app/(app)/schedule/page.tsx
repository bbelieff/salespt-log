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

import { useMemo, useRef, useState } from "react";
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
import WeekHeader from "./_components/WeekHeader";
import SummaryBar from "./_components/SummaryBar";
import DaySection from "./_components/DaySection";
import TopHeader from "@/components/TopHeader";
import { addDays, fmtISO, parseISO, weekIndexOf } from "./_lib/week";
import { useWeekStartSync } from "./_lib/useWeekStartSync";

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

      // Fan-out: NEW 계약 액션일 때만 02 계약수납관리에 row 자동 생성.
      // 이미 계약 상태였던 카드의 수임비/조건 수정은 fan-out 안 함 (중복 row 방지).
      if (
        partial.상태 === "계약" &&
        !wasAlreadyContract &&
        weekQuery.data
      ) {
        const meeting = weekQuery.data.daysByMeetingDate
          .flatMap((d) => d.meetings)
          .find((m) => m.id === id);
        if (meeting) {
          try {
            await addContractPayment.mutateAsync({
              계약일: meeting.미팅날짜,
              업체명: meeting.업체명,
              수임비: partial.수임비 ?? meeting.수임비 ?? 0,
            });
            showToast("✓ 계약 확정 + 계약수납 row 생성됨");
          } catch (e) {
            showToast(
              `⚠ 계약은 저장됐으나 계약수납 row 생성 실패: ${(e as Error).message} — 계약수납 탭에서 수동으로 추가 필요`,
            );
            return;
          }
        } else {
          showToast("✓ 저장 완료 (meeting lookup 실패 — fan-out 생략)");
          return;
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
      ? `\n· 수납탭 계약카드 1건 (₩${(meeting.수임비 ?? 0).toLocaleString()})`
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

  const moveWeek = (delta: number) => {
    setSlideDir(delta > 0 ? "right" : "left");
    const cur = parseISO(weekStart);
    setWeekStart(fmtISO(addDays(cur, delta * 7)));
    setTimeout(() => setSlideDir(null), 260);
  };

  // 2026-05-17 [A3]: 좌우 스와이프로 주 이동.
  const weekSwipe = useSwipe({
    onSwipeLeft: () => moveWeek(1),
    onSwipeRight: () => moveWeek(-1),
  });

  /**
   * 날짜 클릭 시 세로 스크롤 (2026-05-17 [6] 재조정).
   * 주 시작 = 금요일. 인덱스 매핑 (사용자 명세):
   *   금/토/일 (idx 0~2) → 상단 (block: "start")
   *   월/화/수/목 (idx 3~6) → 하단 (block: "end")
   * 이전 [A4]: 월(idx 3)이 start 였음 → 사용자 정정.
   */
  const scrollToDay = (idx: number) => {
    const el = dayRefs.current[idx];
    if (!el) return;
    const block: ScrollLogicalPosition = idx >= 3 ? "end" : "start";
    el.scrollIntoView({ behavior: "smooth", block });
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

  if (weekQuery.isLoading) {
    return (
      <section className="px-4 pt-6 text-sm text-slate-500">
        불러오고 있어요
      </section>
    );
  }
  if (weekQuery.isError) {
    return (
      <section className="px-4 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </div>
      </section>
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
        {daysByMeetingDate.map((day, i) => (
          <div
            key={day.date}
            ref={(el) => {
              dayRefs.current[i] = el;
            }}
          >
            <DaySection
              date={day.date}
              meetings={day.meetings}
              todayISO={TODAY_ISO}
              pendingId={pendingId}
              onPatch={handlePatch}
              onReschedule={handleReschedule}
              onRevert={handleRevert}
              onAddMeeting={handleAddMeeting}
              onDelete={handleDelete}
              followUpParentIds={followUpParentIds}
              onReviveCase={handleReviveCase}
            />
          </div>
        ))}
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
