/**
 * 캘린더 탭 (PR 03 / Phase 4) — 월간뷰 + 선택일 미팅 리스트.
 * 정본: docs/design/prototypes/calendar-monthly.html
 *
 * 카드 클릭 시 /schedule · /payment 로 점프(편집은 거기서).
 * 예외: 일반이벤트(type=일반)는 다른 탭에 안 보이므로 이 화면에서 직접 삭제 (TodoDayCard).
 */
"use client";

import PageContainer from "@/components/PageContainer";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import type { Channel, Meeting, Todo } from "@/types";
import { useMonthMeetings } from "@/query/contact-hooks";
import MonthGrid from "./_components/MonthGrid";
import GcalConnectCard from "./_components/GcalConnectCard";
import GcalItemToggle from "./_components/GcalItemToggle";
import GeneralEventModal from "./_components/GeneralEventModal";
import TodoDayCard from "./_components/TodoDayCard";
import TodoTypeIcon from "./_components/TodoTypeIcon";
import TopHeader from "@/components/TopHeader";
import {
  CARD_ICON,
  meetingStateToCardState,
} from "./_lib/state-map";
import { fmtYM, fmtYMD, parseISO, shiftMonth } from "./_lib/month";
import { formatMoney } from "@/lib/format/money";

const TODAY = new Date();
const TODAY_ISO = fmtYMD(TODAY);
const TODAY_YYYYMM = fmtYM(TODAY);

const KO_DAY = ["일", "월", "화", "수", "목", "금", "토"];

// 일자상세 좌측바 — 채널 4색 진한값(tokens.md), 실무는 진회색. inline style.
const CHANNEL_HEX: Record<Channel, string> = {
  매입DB: "#1d4ed8",
  직접생산: "#15803d",
  현수막: "#b45309",
  "콜·지·기·소": "#7c3aed",
};
const CHANNEL_BADGE: Record<Channel, string> = {
  매입DB: "bg-blue-100 text-blue-700",
  직접생산: "bg-green-100 text-green-700",
  현수막: "bg-amber-100 text-amber-700",
  "콜·지·기·소": "bg-purple-100 text-purple-700",
};
const PRACTICE_HEX = "#334155";
const GENERAL_HEX = "#0d9488"; // tokens 일반이벤트 teal (비집계)
const TODO_TYPES = ["미팅", "전화", "메시지", "기타"] as const;

// 안정 참조 — map.get(date) ?? [] 의 새 배열이 매 렌더 selectedItems/effect 를 무효화하는
// 무한 리페치 루프 방지(gcal-2b states 조회). 빈 날은 항상 같은 배열을 반환.
const NO_MEETINGS: Meeting[] = [];
const NO_TODOS: Todo[] = [];

/** 공용 부품 별칭 — 중복 구현 제거(PR-1 lib/format/money 가 단일 원천). */
const fmtMoney = formatMoney;

export default function CalendarPage() {
  const router = useRouter();
  const [yyyyMM, setYyyyMM] = useState<string>(TODAY_YYYYMM);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY_ISO);
  const monthQuery = useMonthMeetings(yyyyMM);
  const [eventModal, setEventModal] = useState(false); // 일반이벤트 생성 (§4-3)
  // gcal-2b: 일정별 담기/빼기 토글 — 연결 사용자만. 선택일 항목 상태 배치 조회.
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalStates, setGcalStates] = useState<Record<string, boolean>>({});
  const [gcalToast, setGcalToast] = useState<string | null>(null);
  const onGcalChange = useCallback(
    (id: string, on: boolean) => setGcalStates((s) => ({ ...s, [id]: on })),
    [],
  );
  const onGcalToast = useCallback((msg: string) => {
    setGcalToast(msg);
    window.setTimeout(() => setGcalToast(null), 2500);
  }, []);

  // map 변환 (그리드용)
  const meetingsByDate = useMemo(() => {
    const m = new Map<string, Meeting[]>();
    if (!monthQuery.data) return m;
    for (const d of monthQuery.data.daysByMeetingDate) {
      m.set(d.date, d.meetings);
    }
    return m;
  }, [monthQuery.data]);

  const todosByDate = useMemo(() => {
    const m = new Map<string, Todo[]>();
    if (!monthQuery.data) return m;
    for (const d of monthQuery.data.daysByTodoDate) {
      m.set(d.date, d.todos);
    }
    return m;
  }, [monthQuery.data]);

  const selectedMeetings = meetingsByDate.get(selectedDate) ?? NO_MEETINGS;
  const selectedTodos = todosByDate.get(selectedDate) ?? NO_TODOS;
  const selectedDow =
    selectedDate.length >= 10 ? KO_DAY[parseISO(selectedDate).getDay()] : "";

  // 미팅 + 투두 시간순 통합 (일자상세)
  const selectedItems = useMemo(() => {
    const arr: Array<
      | { kind: "meeting"; time: string; m: Meeting }
      | { kind: "todo"; time: string; t: Todo }
    > = [
      ...selectedMeetings.map((m) => ({
        kind: "meeting" as const,
        time: m.미팅시간,
        m,
      })),
      ...selectedTodos.map((t) => ({
        kind: "todo" as const,
        time: t.예정시각,
        t,
      })),
    ];
    arr.sort((a, b) => a.time.localeCompare(b.time));
    return arr;
  }, [selectedMeetings, selectedTodos]);

  // gcal 항목 토글 초기 상태 배치 조회 (연결 사용자만 토글 노출). 선택일 항목 바뀔 때.
  useEffect(() => {
    const meetingIds = selectedItems.flatMap((i) => (i.kind === "meeting" ? [i.m.id] : []));
    const todoIds = selectedItems.flatMap((i) => (i.kind === "todo" ? [i.t.id] : []));
    if (!meetingIds.length && !todoIds.length) return;
    let cancelled = false;
    void fetch("/api/gcal/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingIds, todoIds }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { connected: boolean; states: Record<string, boolean> } | null) => {
        if (cancelled || !data) return;
        setGcalConnected(!!data.connected);
        // 로컬 우선 병합 — 진행 중이던 조회가 늦게 도착해도 방금 토글한 낙관값을 덮지 않음.
        setGcalStates((s) => ({ ...data.states, ...s }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedItems]);

  // 월 요약
  const monthSummary = useMemo(() => {
    if (!monthQuery.data) return null;
    const all = monthQuery.data.daysByMeetingDate.flatMap((d) => d.meetings);
    const todos = monthQuery.data.daysByTodoDate.flatMap((d) => d.todos);
    const fee = all
      .filter((m) => m.계약여부)
      .reduce((s, m) => s + (m.수임비 || 0), 0);
    return {
      total: all.length,
      contract: all.filter((m) => m.상태 === "계약").length,
      fee,
      practice: todos.length,
    };
  }, [monthQuery.data]);

  // 월 이동도 미저장 가드(열린 입력 모달 dirty 면 모달).
  const guardedNav = useGuardedNav();
  const moveMonth = (delta: number) =>
    guardedNav(() => setYyyyMM((cur) => shiftMonth(cur, delta)));

  const jumpToSchedule = () => {
    // 선택일을 넘겨 일정·계약 탭이 그 주(금~목)로 열리게 함.
    // (없으면 도착 탭이 오늘 주차로 auto-align — 선택 맥락 유실)
    router.push(`/schedule?date=${selectedDate}`);
  };

  const [yearStr, monthStr] = yyyyMM.split("-");

  return (
    <>
      <TopHeader pageEmoji="📅" pageTitle="캘린더" />
      <header className="sticky top-24 z-30 bg-white shadow-sm">
        {/* 배경 full-bleed + 월 nav 내용은 본문과 같은 6xl 중앙정렬(헤더 통일 정책) */}
        <div className="mx-auto flex w-full items-center justify-between px-2 py-3 pc:max-w-6xl pc:px-6 wide:px-8">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
            aria-label="이전 달"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <div className="text-base font-bold text-gray-900">
              {yearStr}년 {Number(monthStr)}월
            </div>
            {monthSummary && monthSummary.total + monthSummary.practice > 0 && (
              <div className="mt-0.5 text-xs text-gray-400">
                미팅 {monthSummary.total}건 · 계약 {monthSummary.contract}건
                {monthSummary.practice > 0 &&
                  ` · 실무 ${monthSummary.practice}건`}
                {" · "}
                <span
                  className="font-semibold text-green-700"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  ₩{fmtMoney(monthSummary.fee)}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="flex h-11 w-11 items-center justify-center text-gray-400 transition-all hover:text-gray-600 active:scale-90"
            aria-label="다음 달"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <main className="pb-[80px]">
      <PageContainer width="xwide">
        <div className="px-4 pt-3">
          <GcalConnectCard />
        </div>
        {monthQuery.isLoading ? null : monthQuery.isError ? (
          <div className="px-4 pt-6">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </div>
          </div>
        ) : (
          <div className="pc:grid pc:grid-cols-7 pc:gap-6 pc:items-start">
            <div className="pt-2 pc:col-span-5">
              <MonthGrid
                yyyyMM={yyyyMM}
                todayISO={TODAY_ISO}
                selectedDate={selectedDate}
                meetingsByDate={meetingsByDate}
                todosByDate={todosByDate}
                onSelectDate={setSelectedDate}
              />
            </div>

            {/* 선택일 통합 리스트 (미팅 + 실무투두, 시간순) */}
            {/* 데스크탑: 스크롤해도 선택일 패널이 따라오게 sticky.
                top-40 = 상단 고정 바(메뉴 48 + 배너 48 + 월 nav sticky top-24) 합 회피.
                길면 자체 스크롤(그리드와 독립). 모바일은 일반 흐름. */}
            <section className="mt-4 px-4 pc:mt-0 pc:col-span-2 pc:sticky pc:top-40 pc:self-start pc:max-h-[calc(100vh-11rem)] pc:overflow-y-auto">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {selectedDate.replace(/^\d{4}-/, "").replace("-", "/")} (
                  {selectedDow})
                  {selectedDate === TODAY_ISO && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                      오늘
                    </span>
                  )}
                </h2>
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  {selectedItems.length > 0
                    ? `${selectedItems.length}건`
                    : "일정 없음"}
                  <button
                    type="button"
                    onClick={() => setEventModal(true)}
                    aria-label="일반이벤트 추가"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white active:scale-95"
                    style={{ background: GENERAL_HEX }}
                  >
                    +
                  </button>
                </span>
              </div>

              {selectedItems.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                  이 날은 일정이 없어요
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedItems.map((item) => {
                    if (item.kind === "meeting") {
                      const m = item.m;
                      const state = meetingStateToCardState(m.상태);
                      return (
                        <li
                          key={`m-${m.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            router.push(
                              `/schedule?date=${selectedDate}&focus=${m.id}`,
                            )
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
                          style={{
                            borderLeft: `3px solid ${CHANNEL_HEX[m.channel]}`,
                          }}
                        >
                          <span
                            className="shrink-0 text-sm font-bold text-gray-700"
                            style={{ width: 44 }}
                          >
                            {m.미팅시간}
                          </span>
                          <span
                            className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold ${CHANNEL_BADGE[m.channel]}`}
                          >
                            {CARD_ICON[state]} 영업
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {m.업체명}
                            </div>
                            <div className="truncate text-[11px] text-gray-400">
                              {m.channel}
                            </div>
                          </div>
                          {state === "contract" && m.수임비 > 0 ? (
                            <span
                              className="shrink-0 text-xs font-bold text-green-700"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              ₩{fmtMoney(m.수임비)}
                            </span>
                          ) : (
                            m.장소 && (
                              <span className="max-w-20 shrink-0 truncate text-xs text-gray-400">
                                {m.장소}
                              </span>
                            )
                          )}
                          {gcalConnected && (
                            <GcalItemToggle
                              kind="meeting"
                              id={m.id}
                              on={gcalStates[m.id] ?? true}
                              onChange={onGcalChange}
                              onToast={onGcalToast}
                            />
                          )}
                        </li>
                      );
                    }
                    const t = item.t;
                    return (
                      <TodoDayCard
                        key={`t-${t.id}`}
                        t={t}
                        gcalConnected={gcalConnected}
                        gcalOn={gcalStates[t.id] ?? true}
                        onGcalChange={onGcalChange}
                        onGcalToast={onGcalToast}
                      />
                    );
                  })}
                </ul>
              )}

              {/* B4: 캘린더는 일정·계약 / 실무·수납 두 탭의 허브 → 두 버튼 항상 노출. */}
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={jumpToSchedule}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  ← 📋 일정·계약 탭으로 이동
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/payment")}
                  className="w-full rounded-xl border py-2.5 text-sm font-medium"
                  style={{
                    background: "#f1f5f9",
                    color: PRACTICE_HEX,
                    borderColor: "#cbd5e1",
                  }}
                >
                  💰 실무/수납 탭으로 이동 →
                </button>
              </div>

            </section>
          </div>
        )}
        {/* 범례 — 그리드+패널 아래 full-width 스트립. 영업/실무 각각 한 줄(nowrap, break-keep)
            → 좁은 패널에서 '콜·지·기·소' wrap 되던 문제 해소. 아주 좁으면 가로 스크롤. */}
        {!monthQuery.isLoading && !monthQuery.isError && (
          <div className="mt-4">
            <div className="mb-1 text-[11px] text-gray-400">범례</div>
            <div className="flex flex-col gap-1.5 overflow-x-auto rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-xs text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
              <div className="flex flex-nowrap items-center gap-2 break-keep">
                <span className="shrink-0 font-medium text-gray-400" style={{ width: 36 }}>
                  영업
                </span>
                {(Object.keys(CHANNEL_HEX) as Channel[]).map((ch) => (
                  <span key={ch} className="flex shrink-0 items-center gap-1 whitespace-nowrap break-keep">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: CHANNEL_HEX[ch] }} />
                    {ch}
                  </span>
                ))}
              </div>
              <div className="flex flex-nowrap items-center gap-2 break-keep">
                <span className="shrink-0 font-medium text-gray-400" style={{ width: 36 }}>
                  일반
                </span>
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: GENERAL_HEX }}>
                    <TodoTypeIcon type="일반" size={10} />
                  </span>
                  일반이벤트 (점수 미포함)
                </span>
              </div>
              <div className="flex flex-nowrap items-center gap-2 break-keep">
                <span className="shrink-0 font-medium text-gray-400" style={{ width: 36 }}>
                  실무
                </span>
                {TODO_TYPES.map((t) => (
                  <span key={t} className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: PRACTICE_HEX }}
                    >
                      <TodoTypeIcon type={t} size={10} />
                    </span>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </PageContainer>
      </main>
      {eventModal && (
        <GeneralEventModal
          defaultDate={selectedDate}
          onClose={() => setEventModal(false)}
          onCreated={() => monthQuery.refetch()}
        />
      )}
      {gcalToast && (
        <div
          className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {gcalToast}
          </div>
        </div>
      )}
    </>
  );
}
