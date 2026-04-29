/**
 * 캘린더 탭 — 미팅 상태 ↔ 시각 매핑 (schedule 탭과 동일 정책).
 * TODO(future): app/(app)/schedule/_lib/state-map.ts 와 통합 (lib/util/state-map.ts).
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

export const CARD_ICON: Record<CardState, string> = {
  reserved: "🟡",
  contract: "💵",
  done: "🟠",
  rescheduled: "📅",
  canceled: "🔴",
};
