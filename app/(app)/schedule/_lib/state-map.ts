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

/** 미팅 줄 — 상자 없이 아래 구분선. 변경·취소는 흐리게. */
export const ROW_CLS: Record<CardState, string> = {
  reserved: "",
  contract: "",
  done: "",
  rescheduled: "opacity-85",
  canceled: "opacity-75",
};

/** 닫힌 줄의 시간 글자 색 — 상태를 색 글자로(tokens.md 미팅 상태 색). 취소는 줄긋기 회색이 우선. */
export const TIME_TEXT_CLS: Record<CardState, string> = {
  reserved: "text-amber-700",
  contract: "text-green-700",
  done: "text-orange-700",
  rescheduled: "text-purple-700",
  canceled: "text-slate-400",
};

/** 카드 헤더 좌측 상태 아이콘 (이모지). */
export const CARD_ICON: Record<CardState, string> = {
  reserved: "🟡",
  contract: "💵",
  done: "🟠",
  rescheduled: "📅",
  canceled: "🔴",
};
