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

import { useEffect, useMemo, useRef, useState } from "react";
import type { Meeting } from "@/types";
import {
  useAppendMeeting,
  usePatchMeeting,
  useWeekMeetings,
} from "@/query/contact-hooks";
import WeekHeader from "./_components/WeekHeader";
import SummaryBar from "./_components/SummaryBar";
import DaySection from "./_components/DaySection";
import { addDays, fmtISO, parseISO } from "./_lib/week";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TODAY_ISO = fmtISO(new Date());

export default function SchedulePage() {
  // 첫 로딩 시 weekStart는 일단 오늘. 서버 응답에서 courseStart 받아 정렬은 그 후.
  // (서버는 input weekStart를 그대로 사용. courseStart 첫 조회는 컨택탭 열 때 같이.)
  // 단순화: 첫 weekStart = 오늘이 속한 주의 토요일(courseStart 모를 때 임시).
  // → 서버가 weekStart 검증해서 적절한 weekIndex 반환. 그 결과로 화면에 정확한 7일 표시.
  // 더 단순하게: 처음에 오늘을 weekStart로 보내고, 서버에서 받은 courseStart를 보고
  // 사용자가 [이전/다음 주] 누를 때만 7일씩 점프. 첫 응답이 weekIndex=0이면 7일 차감.
  const [weekStart, setWeekStart] = useState<string>(TODAY_ISO);

  const weekQuery = useWeekMeetings(weekStart);
  const patchMeeting = usePatchMeeting();
  const appendMeeting = useAppendMeeting();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const dayRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 처음 로드 후 courseStart 기준으로 weekStart를 그 주의 시작일로 정렬.
  // (사용자가 4/30(목) 접속하면 weekStart는 4/25(토)로 자동 정렬)
  const aligned = useRef(false);
  useEffect(() => {
    if (!weekQuery.data || aligned.current) return;
    aligned.current = true;
    const { courseStart } = weekQuery.data;
    const cs = parseISO(courseStart);
    const today = parseISO(TODAY_ISO);
    const diffDays = Math.round(
      (today.getTime() - cs.getTime()) / 86_400_000,
    );
    if (diffDays < 0) return; // 수강 시작 전
    const weekIdx = Math.floor(diffDays / 7);
    const correctStart = addDays(cs, weekIdx * 7);
    const correctIso = fmtISO(correctStart);
    if (correctIso !== weekStart) setWeekStart(correctIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekQuery.data?.courseStart]);

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
      await patchMeeting.mutateAsync({
        date: "", // 일정·계약 탭에선 day-key 무관
        weekStart,
        id,
        partial,
      });
      showToast("✓ 저장 완료");
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
    const newMeeting: Meeting = {
      ...original,
      id: newId,
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

  const moveWeek = (delta: number) => {
    const cur = parseISO(weekStart);
    setWeekStart(fmtISO(addDays(cur, delta * 7)));
  };

  const scrollToDay = (idx: number) => {
    const el = dayRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 메모: 모든 미팅 평탄화 (요약 바 입력)
  const allMeetings = useMemo(() => {
    if (!weekQuery.data) return [] as Meeting[];
    return weekQuery.data.daysByMeetingDate.flatMap((d) => d.meetings);
  }, [weekQuery.data]);

  const countsByDay = useMemo(() => {
    if (!weekQuery.data) return Array(7).fill(0) as number[];
    return weekQuery.data.daysByMeetingDate.map((d) => d.meetings.length);
  }, [weekQuery.data]);

  if (weekQuery.isLoading) {
    return (
      <section className="px-4 pt-6 text-sm text-slate-500">
        불러오는 중…
      </section>
    );
  }
  if (weekQuery.isError) {
    return (
      <section className="px-4 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠ 불러오기 실패: {(weekQuery.error as Error).message}
        </div>
      </section>
    );
  }
  if (!weekQuery.data) return null;

  const { weekIndex, daysByMeetingDate } = weekQuery.data;

  return (
    <>
      <WeekHeader
        weekIndex={weekIndex}
        weekStart={weekStart}
        todayISO={TODAY_ISO}
        countsByDay={countsByDay}
        onPrevWeek={() => moveWeek(-1)}
        onNextWeek={() => moveWeek(1)}
        onClickDay={scrollToDay}
      />

      <SummaryBar meetings={allMeetings} />

      <main className="px-4 pb-[80px] pt-1">
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
            />
          </div>
        ))}
      </main>

      {toast && (
        <div className="fixed bottom-[80px] left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
