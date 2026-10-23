/**
 * 영업활동일 판정 — 순수 함수(import는 타입·날짜 유틸뿐). 심리장치 단계 0 정본.
 * 대시보드·웹 푸시·주간 리포트가 같은 판정을 쓰도록 여기 하나에 둔다.
 *
 * - sales(영업활동일): 실제 고객 행동을 기록한 날 — 연락 결과·상담·미팅 예약·미팅 결과·계약·업무 완료.
 * - record(기록일): 영업행동은 아니지만 일지를 남긴 날 — 일일 실적 직접 입력, 「특이사항 없음 한 줄」.
 * - 열람·알림 탭·날짜만 미루기·과거 일괄 적재는 이벤트로 넘기지 않는다(호출부 책임).
 * 날짜는 KST "YYYY-MM-DD". 오늘 이후 날짜는 미리 깔린 빈 행일 수 있어 세지 않는다.
 */
import type { MeetingState } from "@/types/meeting";
import { isValidISODate, parseISO } from "@/util/week";

export type ActivityEvent =
  | { kind: "contact"; date: string; result: string }
  | { kind: "meetingBooked"; date: string }
  | { kind: "meetingResult"; date: string; state: MeetingState }
  | { kind: "contract"; date: string }
  | { kind: "todoDone"; date: string }
  | { kind: "dailyMetrics"; date: string }
  | { kind: "noteOnly"; date: string };

export type DayKind = "sales" | "record";
/** off = 영업 요일이 아닌 날(쉬는 날), upcoming = 아직 오지 않은 영업 요일. 둘을 섞지 않는다. */
export type WeekDayState = "sales" | "record" | "empty" | "today" | "upcoming" | "off";

/** 고객에게 실제로 연락한 결과로 보는 컨택 결과. 미컨택·AS예정은 연락이 아니다. */
const CONTACT_RESULTS: ReadonlySet<string> = new Set(["부재", "단순거절", "재통화", "컨택진행", "상담 후 거절"]);

export function classifyActivity(e: ActivityEvent): DayKind | null {
  switch (e.kind) {
    case "contact": return CONTACT_RESULTS.has(e.result) ? "sales" : null;
    case "meetingResult": return e.state === "완료" || e.state === "계약" ? "sales" : null;
    case "meetingBooked": case "contract": case "todoDone": return "sales";
    case "dailyMetrics": case "noteOnly": return "record";
  }
}

/** 날짜별 가장 강한 종류(sales > record). 같은 날 여러 건은 하루로 센다. */
export function activityDays(events: readonly ActivityEvent[], today: string): Map<string, DayKind> {
  const days = new Map<string, DayKind>();
  for (const e of events) {
    if (!isValidISODate(e.date) || e.date > today) continue;
    const kind = classifyActivity(e);
    if (!kind || days.get(e.date) === "sales") continue;
    days.set(e.date, kind);
  }
  return days;
}

/**
 * 기본 영업 요일 = 월~금(getDay 기준). 표시용 요일 구분일 뿐 목표가 아니다.
 * 알림 '받는 요일'과 묶지 않는다 — 알림을 줄였다고 영업 요일·목표가 바뀌면 안 된다(출처는 belie 결정 전).
 */
export const DEFAULT_WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];

function isOffDay(date: string, workdays: readonly number[]): boolean {
  return !workdays.includes(parseISO(date).getDay());
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parseISO(start); ; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (iso > end) break;
    out.push(iso);
  }
  return out;
}

/**
 * 한 주(창은 호출부가 정한다 — 주간목표 카드는 goalWeekWindow의 금~목)의 점 표시.
 * 쉬는 요일은 활동이 있으면 그대로 보여 주되 분모(영업 요일 수)에는 넣지 않는다 — 쉬는 날은 빈칸이 아니다.
 */
export function summarizeWeek(days: ReadonlyMap<string, DayKind>, window: { start: string; end: string }, today: string, workdays: readonly number[] = DEFAULT_WORKDAYS) {
  const dates = eachDate(window.start, window.end);
  const cells = dates.map(date => {
    const kind = days.get(date);
    const state: WeekDayState = kind ?? (date === today ? "today" : isOffDay(date, workdays) ? "off" : date > today ? "upcoming" : "empty");
    return { date, state };
  });
  return {
    cells,
    salesDays: cells.filter(c => c.state === "sales").length,
    recordDays: cells.filter(c => c.state === "record").length,
    weekdays: dates.filter(d => !isOffDay(d, workdays)).length,
  };
}

/** 누적 영업활동일 — 줄어들지 않는 숫자. 이정표(10·30·100일) 판정에 쓴다. */
export function cumulativeSalesDays(days: ReadonlyMap<string, DayKind>): number {
  let n = 0;
  for (const kind of days.values()) if (kind === "sales") n++;
  return n;
}
