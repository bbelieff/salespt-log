"use client";
/** 일정·계약 탭 보기 상태 — 요일 순서(금~목/월~일, 이 브라우저에 기억)와 PC 주간 보드 여부(1280px 이상).
 *  캘린더 한 달 보드도 같은 기준을 쓴다. ready = 화면 폭을 잰 뒤(그 전에는 어느 쪽인지 모른다). */
import { useEffect, useState } from "react";
import { viewStartOf, type DayOrder } from "./board";
import { fmtISO, friOf, parseISO } from "./week";

const KEY = "schedule-day-order";

export function useBoardView(weekStart: string) {
  const [order, setOrderState] = useState<DayOrder>("fri");
  const [isBoard, setIsBoard] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === "mon") setOrderState("mon"); } catch { /* 저장소 막힘 — 기본 금~목 */ }
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsBoard(mq.matches);
    sync();
    setReady(true);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const setOrder = (o: DayOrder) => {
    setOrderState(o);
    try { localStorage.setItem(KEY, o); } catch { /* 이번 화면에서만 */ }
  };
  // 월~일은 수강 주(금)를 먼저 맞춘 뒤 그 안의 월요일 — 첫 로드 전 weekStart 가 오늘이어도 같은 주를 본다.
  const viewStart = order === "fri" ? weekStart : viewStartOf(fmtISO(friOf(parseISO(weekStart))), "mon");
  return { order, setOrder, viewStart, isBoard, ready };
}
