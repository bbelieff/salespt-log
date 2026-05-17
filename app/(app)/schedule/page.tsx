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
  useRevertMeeting,
  useWeekMeetings,
} from "@/query/contact-hooks";
import {
  useAddContractPayment,
  useSyncContractFee,
} from "@/query/contract-payment-hooks";
import WeekHeader from "./_components/WeekHeader";
import SummaryBar from "./_components/SummaryBar";
import DaySection from "./_components/DaySection";
import TopHeader from "@/components/TopHeader";
import { addDays, fmtISO, friOf, parseISO, weekIndexOf } from "./_lib/week";

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
  const revertMeeting = useRevertMeeting();
  const addContractPayment = useAddContractPayment();
  const syncContractFee = useSyncContractFee();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const dayRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 처음 로드 후 weekStart를 그 주의 금요일(Fri-Thu 주)로 정렬.
  // 예: 사용자가 4/30(목)에 접속 → weekStart = 4/24(금)
  const aligned = useRef(false);
  useEffect(() => {
    if (!weekQuery.data || aligned.current) return;
    aligned.current = true;
    const today = parseISO(TODAY_ISO);
    const todayFri = friOf(today);
    const correctIso = fmtISO(todayFri);
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
   * 추가 미팅 (2026-05-17 [2b]).
   * 완료/취소/계약 카드에서 같은 업체로 새 미팅 row append.
   * 채널/장소/예약비고 동일, 새 id, 상태=예약, previousMeetingId 없음 (독립 미팅).
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
      previousMeetingId: "", // 독립 미팅 — 체이닝 안 함
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

  const moveWeek = (delta: number) => {
    const cur = parseISO(weekStart);
    setWeekStart(fmtISO(addDays(cur, delta * 7)));
  };

  /**
   * 날짜 클릭 시 세로 스크롤 (2026-05-17 [A4] fix).
   * 주 시작 = 금요일. 인덱스 매핑:
   *   0=금, 1=토, 2=일, 3=월 → 상단 (block: "start") — 일주일 시작 쪽
   *   4=화, 5=수, 6=목 → 하단 (block: "end") — 일주일 끝 쪽
   * 이전: 모든 idx 가 block: "start" → 화~목 클릭 시 화면 너무 위로 가서 동작 어색.
   */
  const scrollToDay = (idx: number) => {
    const el = dayRefs.current[idx];
    if (!el) return;
    const block: ScrollLogicalPosition = idx >= 4 ? "end" : "start";
    el.scrollIntoView({ behavior: "smooth", block });
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
        pageSubtitle="04 업체관리"
      />
      {/* WeekHeader + SummaryBar 를 하나의 sticky 컨테이너로 묶어 drift 방지.
          (이전: 각자 sticky → top 값 추정에 의존하여 살짝 흔들림) */}
      <div className="sticky top-24 z-30">
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
      </div>

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
              onRevert={handleRevert}
              onAddMeeting={handleAddMeeting}
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
