/**
 * 캘린더 탭 (PR 03 / Phase 4) — 월간뷰 + 선택일 미팅 리스트.
 * 정본: docs/design/prototypes/calendar-monthly.html
 *
 * 읽기 전용. 카드 클릭 시 /schedule 로 점프(편집은 거기서).
 */
"use client";

import PageContainer from "@/components/PageContainer";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, Meeting, Todo } from "@/types";
import { useMonthMeetings } from "@/query/contact-hooks";
import MonthGrid from "./_components/MonthGrid";
import TodoTypeIcon from "./_components/TodoTypeIcon";
import TopHeader from "@/components/TopHeader";
import {
  CARD_ICON,
  meetingStateToCardState,
} from "./_lib/state-map";
import { fmtYM, fmtYMD, parseISO, shiftMonth } from "./_lib/month";

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
const TODO_TYPES = ["미팅", "전화", "메시지", "기타"] as const;

function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function CalendarPage() {
  const router = useRouter();
  const [yyyyMM, setYyyyMM] = useState<string>(TODAY_YYYYMM);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY_ISO);
  const monthQuery = useMonthMeetings(yyyyMM);

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

  const selectedMeetings = meetingsByDate.get(selectedDate) ?? [];
  const selectedTodos = todosByDate.get(selectedDate) ?? [];
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

  const moveMonth = (delta: number) => {
    setYyyyMM((cur) => shiftMonth(cur, delta));
  };

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
        {monthQuery.isLoading ? (
          <div className="px-4 pt-6 text-sm text-slate-500">불러오고 있어요</div>
        ) : monthQuery.isError ? (
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
            <section className="mt-4 px-4 pc:mt-0 pc:col-span-2">
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
                <span className="text-xs text-gray-500">
                  {selectedItems.length > 0
                    ? `${selectedItems.length}건`
                    : "일정 없음"}
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
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
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
                        </li>
                      );
                    }
                    const t = item.t;
                    return (
                      <li
                        key={`t-${t.id}`}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
                        style={{ borderLeft: `3px solid ${PRACTICE_HEX}` }}
                      >
                        <span
                          className="shrink-0 text-sm font-bold text-gray-700"
                          style={{ width: 44 }}
                        >
                          {t.예정시각 || "—"}
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-white"
                          style={{ background: PRACTICE_HEX }}
                        >
                          <TodoTypeIcon type={t.type} size={12} /> 실무
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {t.업체명 || t.제목}
                          </div>
                          <div className="truncate text-[11px] text-gray-400">
                            {t.제목}
                          </div>
                        </div>
                        {t.장소 && (
                          <span className="max-w-20 shrink-0 truncate text-xs text-gray-400">
                            {t.장소}
                          </span>
                        )}
                      </li>
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
    </>
  );
}
