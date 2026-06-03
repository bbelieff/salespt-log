/**
 * 일정·계약 탭 weekStart 초기 동기화 훅.
 *
 * 두 경로를 한곳에서 관리:
 *  1) 캘린더에서 ?date= 로 넘어온 경우 → 그 날짜의 주(금~목)로 초기화하고
 *     today-스냅을 잠근다(aligned=true). 사용자가 본 주차 맥락 유지.
 *     Next 15 useSearchParams Suspense 경계 회피 → mount 시
 *     window.location.search 직접 파싱(컨택탭 page.tsx 기존 패턴 동일).
 *  2) ?date= 없으면 첫 데이터(courseStart) 로드 후 오늘이 속한 주의 금요일로 정렬.
 *     예: 사용자가 4/30(목)에 접속 → weekStart = 4/24(금).
 *
 * (서버는 input weekStart 를 그대로 사용 — 편집기간 밖 날짜여도 해당 주를 read.)
 */
import { useEffect, useRef } from "react";
import { fmtISO, friOf, parseISO } from "./week";

export function useWeekStartSync(
  weekStart: string,
  setWeekStart: (iso: string) => void,
  /** 첫 응답에 담긴 courseStart(없으면 미로드) — 변경 시 today-정렬 1회 트리거. */
  courseStart: string | undefined,
  todayISO: string,
): void {
  const aligned = useRef(false);

  // (1) ?date= 우선 — 마운트 1회.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setWeekStart(fmtISO(friOf(parseISO(d))));
      aligned.current = true; // (2) today-스냅 방지
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (2) 데이터 로드 후 today 주차로 정렬 — ?date= 로 잠겼으면 skip.
  useEffect(() => {
    if (!courseStart || aligned.current) return;
    aligned.current = true;
    const correctIso = fmtISO(friOf(parseISO(todayISO)));
    if (correctIso !== weekStart) setWeekStart(correctIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseStart]);
}
