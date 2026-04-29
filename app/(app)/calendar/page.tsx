/**
 * 캘린더 탭 (PR 03 / Phase 4) — 월간뷰 + 선택일 미팅 리스트.
 * 정본: docs/design/prototypes/calendar-monthly.html
 *
 * 읽기 전용. 카드 클릭 시 /schedule 로 점프(편집은 거기서).
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Meeting } from "@/types";
import { useMonthMeetings } from "@/query/contact-hooks";
import MonthGrid from "./_components/MonthGrid";
import {
  CARD_ICON,
  meetingStateToCardState,
} from "./_lib/state-map";
import { fmtYM, fmtYMD, parseISO, shiftMonth } from "./_lib/month";

const TODAY = new Date();
const TODAY_ISO = fmtYMD(TODAY);
const TODAY_YYYYMM = fmtYM(TODAY);

const KO_DAY = ["일", "월", "화", "수", "목", "금", "토"];

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

  const selectedMeetings = meetingsByDate.get(selectedDate) ?? [];
  const selectedDow =
    selectedDate.length >= 10 ? KO_DAY[parseISO(selectedDate).getDay()] : "";

  // 월 요약
  const monthSummary = useMemo(() => {
    if (!monthQuery.data) return null;
    const all = monthQuery.data.daysByMeetingDate.flatMap((d) => d.meetings);
    const fee = all
      .filter((m) => m.계약여부)
      .reduce((s, m) => s + (m.수임비 || 0), 0);
    return {
      total: all.length,
      contract: all.filter((m) => m.상태 === "계약").length,
      fee,
    };
  }, [monthQuery.data]);

  const moveMonth = (delta: number) => {
    setYyyyMM((cur) => shiftMonth(cur, delta));
  };

  const jumpToSchedule = () => {
    // /schedule은 currently weekStart 기반. 단순 이동만 (auto-align).
    router.push("/schedule");
  };

  const [yearStr, monthStr] = yyyyMM.split("-");

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between px-2 py-3">
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
            {monthSummary && monthSummary.total > 0 && (
              <div className="mt-0.5 text-xs text-gray-400">
                미팅 {monthSummary.total}건 · 계약 {monthSummary.contract}건 ·{" "}
                <span className="font-semibold text-green-700">
                  {fmtMoney(monthSummary.fee)}만원
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
        {monthQuery.isLoading ? (
          <div className="px-4 pt-6 text-sm text-slate-500">불러오는 중…</div>
        ) : monthQuery.isError ? (
          <div className="px-4 pt-6">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠ 불러오기 실패: {(monthQuery.error as Error).message}
            </div>
          </div>
        ) : (
          <>
            <div className="pt-2">
              <MonthGrid
                yyyyMM={yyyyMM}
                todayISO={TODAY_ISO}
                selectedDate={selectedDate}
                meetingsByDate={meetingsByDate}
                onSelectDate={setSelectedDate}
              />
            </div>

            {/* 선택일 미팅 리스트 */}
            <section className="mt-4 px-4">
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
                  {selectedMeetings.length > 0
                    ? `${selectedMeetings.length}건`
                    : "미팅 없음"}
                </span>
              </div>

              {selectedMeetings.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                  이 날 미팅이 없습니다
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedMeetings.map((m) => {
                    const state = meetingStateToCardState(m.상태);
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <span className="shrink-0 text-base leading-none">
                          {CARD_ICON[state]}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-gray-700">
                          {m.미팅시간}
                        </span>
                        <span className="flex-1 truncate text-sm font-semibold text-gray-900">
                          {m.업체명}
                        </span>
                        <span className="max-w-20 shrink-0 truncate text-xs text-gray-500">
                          {m.장소}
                        </span>
                        {state === "contract" && m.수임비 > 0 && (
                          <span className="shrink-0 text-xs font-bold text-green-700">
                            {fmtMoney(m.수임비)}만원
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedMeetings.length > 0 && (
                <button
                  type="button"
                  onClick={jumpToSchedule}
                  className="mt-3 w-full rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  📋 일정·계약 탭에서 처리하기 →
                </button>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
