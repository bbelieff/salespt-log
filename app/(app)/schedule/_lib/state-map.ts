/**
 * 5상태(예약/계약/완료/변경/취소) ↔ 시각 표현 매핑.
 * 시안 정본: docs/design/prototypes/schedule-weekly.html
 *
 * Phase 1 (PR 03): 변경(rescheduled) 상태는 표시만 (액션 disabled).
 */
import type { MeetingState } from "@/types";

export type CardState =
  | "reserved"
  | "contract"
  | "done"
  | "rescheduled"
  | "canceled";

export function meetingStateToCardState(s: MeetingState): CardState {
  switch (s) {
    case "계약":
      return "contract";
    case "완료":
      return "done";
    case "변경":
      return "rescheduled";
    case "취소":
      return "canceled";
    case "예약":
    default:
      return "reserved";
  }
}

/** 카드 컨테이너 색상 클래스 (좌측 4px 보더 + 옅은 배경). */
export const CARD_CLS: Record<CardState, string> = {
  reserved: "bg-amber-50 border-l-4 border-amber-400",
  contract:
    "bg-green-50 border-l-4 border-green-600 shadow-md shadow-green-600/15",
  done: "bg-orange-50 border-l-4 border-orange-400",
  rescheduled: "bg-purple-50 border-l-4 border-purple-500 opacity-85",
  canceled: "bg-red-50 border-l-4 border-red-500 opacity-75",
};

/** 카드 헤더 좌측 상태 아이콘 (이모지). */
export const CARD_ICON: Record<CardState, string> = {
  reserved: "🟡",
  contract: "💵",
  done: "🟠",
  rescheduled: "📅",
  canceled: "🔴",
};

/** 한국어 라벨. */
export const CARD_LABEL: Record<CardState, string> = {
  reserved: "예약",
  contract: "계약",
  done: "완료(계약X)",
  rescheduled: "변경됨",
  canceled: "취소",
};
