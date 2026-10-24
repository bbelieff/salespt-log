/**
 * 운영 기록 → 영업활동일 이벤트 변환 — 순수 함수(DB 접근 없음). 심리장치 단계 0 둘째 조각.
 * 판정 자체는 activity-days.ts 가 한다. 여기서는 "어느 기록을 어느 날짜로 넘길지"만 정한다.
 *
 * - 날짜는 항상 활동한 날(KST)이다. 저장한 시각이 아니다 — 몰아 적은 기록은 그 활동일에 들어간다.
 * - 업무 할 일(기록종류=todo)의 완료는 완료 날짜가 저장되지 않아 넘기지 않는다. 이미 한 일(history)만 넘긴다.
 * - 일일 실적 행은 값이 모두 0이면 넘기지 않는다(시트 이관 때 미리 깔린 빈 날짜행).
 */
import type { ContractPayment, Meeting, Todo } from "@/types";
import type { ActivityEvent } from "./activity-days";

/** db_sheet_contacts 한 행(연락 1회). repo 타입에 기대지 않도록 필요한 칸만 받는다. */
export interface ContactLogRow { date: string; result: string }

/** 일일 실적 행. repo 의 DbSalesRow 와 같은 칸 중 필요한 것만. */
export interface DailyMetricsRow { date: string; production: number; inflow: number; contactProgress: number; meetingReservation: number }

export interface ActivitySources {
  contacts?: readonly ContactLogRow[];
  meetings?: readonly Meeting[];
  contracts?: readonly ContractPayment[];
  todos?: readonly Todo[];
  dailyMetrics?: readonly DailyMetricsRow[];
}

export function toActivityEvents(src: ActivitySources): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const c of src.contacts ?? []) events.push({ kind: "contact", date: c.date, result: c.result });
  for (const m of src.meetings ?? []) {
    // 예약을 잡은 일 자체가 그날의 영업행동이다 — 나중에 취소·변경돼도 그날 한 일은 지우지 않는다.
    events.push({ kind: "meetingBooked", date: m.예약일 });
    events.push({ kind: "meetingResult", date: m.미팅날짜, state: m.상태 });
  }
  for (const c of src.contracts ?? []) if (c.계약일) events.push({ kind: "contract", date: c.계약일 });
  for (const t of src.todos ?? []) if (t.기록종류 === "history") events.push({ kind: "todoDone", date: t.예정일자 });
  for (const r of src.dailyMetrics ?? []) {
    if (r.production + r.inflow + r.contactProgress + r.meetingReservation > 0) events.push({ kind: "dailyMetrics", date: r.date });
  }
  return events;
}
