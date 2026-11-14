/**
 * 캘린더 탭 — 1280px 이상은 PC 한 달 보드(MonthBoard), 미만은 폰·태블릿 월 보기(PhoneMonth).
 * (보드를 1024px 부터 쓰면 사이드탭 224px 을 뺀 달력 칸이 56px 쯤으로 좁아져, 그 구간은 꽉 찬 달력을 넓게 쓴다.)
 * 두 화면 모두 일정을 누르면 탭 이동 없이 그 자리에서 처리하고, 「주 | 월」로 일정·계약 탭과 날짜를 지닌 채 오간다.
 * 시안: docs/design/prototypes/calendar-month-board.html(PC) · calendar-phone.html(폰)
 */
"use client";

import PageContainer from "@/components/PageContainer";
import TopHeader from "@/components/TopHeader";
import { useEffect, useState } from "react";
import { useGuardedNav } from "@/components/DirtyGuard";
import { useRouter } from "next/navigation";
import MonthBoard from "./_components/board/MonthBoard";
import PhoneMonth from "./_components/phone/PhoneMonth";
import ViewSwitch from "../schedule/_components/board/ViewSwitch";
import { useBoardView } from "../schedule/_lib/useBoardView";
import { fmtYM, fmtYMD, shiftMonth } from "./_lib/month";

const TODAY_ISO = fmtYMD(new Date());
const TODAY_YYYYMM = fmtYM(new Date());
const chev = (d: string) => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function CalendarPage() {
  const router = useRouter();
  const [yyyyMM, setYyyyMM] = useState<string>(TODAY_YYYYMM);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY_ISO);
  // 한 달 보드는 주간 보드와 같은 1280px 부터. 요일 순서도 같은 설정.
  const { order, setOrder, isBoard, ready } = useBoardView(TODAY_ISO);
  // 주간 보드의 「월」·알림 링크가 ?date= 로 넘어오면 그 달·그 날로 맞춘다. window 직접 파싱(Suspense 회피).
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setSelectedDate(d); setYyyyMM(d.slice(0, 7)); }
  }, []);

  // 달 이동·화면 전환도 미저장 가드(열린 입력이 dirty 면 확인).
  const guardedNav = useGuardedNav();
  const moveMonth = (delta: number) => guardedNav(() => setYyyyMM((cur) => shiftMonth(cur, delta)));
  const pick = (date: string) => { setSelectedDate(date); setYyyyMM(date.slice(0, 7)); };
  const toWeek = (date: string) => guardedNav(() => router.push(`/schedule?date=${date}`));
  const thisMonth = () => guardedNav(() => pick(TODAY_ISO));

  // 화면 폭을 재기 전에는 어느 화면인지 모른다 — 다른 화면이 잠깐 비치지 않게 빈 자리만 둔다.
  if (!ready) return <><TopHeader pageEmoji="📅" pageTitle="캘린더" /><div aria-busy="true" className="px-4 pt-6 pc:px-6" /></>;

  if (isBoard) {
    return (
      <>
        <TopHeader pageEmoji="📅" pageTitle="캘린더" />
        <MonthBoard yyyyMM={yyyyMM} selected={selectedDate} todayISO={TODAY_ISO} order={order} onOrder={setOrder}
          onMove={moveMonth} onThisMonth={thisMonth} onWeek={toWeek}
          onSelect={(date, out) => (out ? guardedNav(() => pick(date)) : setSelectedDate(date))} />
      </>
    );
  }

  const NAV = "grid h-11 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-200";
  return (
    <>
      <TopHeader pageEmoji="📅" pageTitle="캘린더" pageNavigation={
        <nav aria-label="달 이동" className="flex min-w-0 flex-1 items-center">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className={NAV}>{chev("M15 18l-6-6 6-6")}</button>
          <button type="button" onClick={thisMonth} title="이번 달로" className="whitespace-nowrap px-1 text-lg font-black tracking-tight text-slate-900 tabular-nums">
            {yyyyMM.slice(0, 4) === TODAY_YYYYMM.slice(0, 4) ? "" : `${yyyyMM.slice(0, 4)}년 `}{Number(yyyyMM.slice(5))}월
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className={NAV}>{chev("M9 18l6-6-6-6")}</button>
          <ViewSwitch view="month" onView={() => toWeek(selectedDate)} className="ml-auto" />
        </nav>
      } />
      <PageContainer width="fluid" className="!px-0">
        <PhoneMonth yyyyMM={yyyyMM} selected={selectedDate} todayISO={TODAY_ISO} order={order} onOrder={setOrder} onSelect={setSelectedDate} />
      </PageContainer>
    </>
  );
}
