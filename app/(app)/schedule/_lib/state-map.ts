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

/** 펼친 카드 컨테이너 색상 클래스 (좌측 4px 보더 + 옅은 배경).
 *  화면 마감 v2(2026-11-10): 닫힌 미팅은 줄(ROW_CLS), 펼쳐 편집할 때만 이 카드 한 단. 그림자 없음(테두리 하나만). */
export const CARD_CLS: Record<CardState, string> = {
  reserved: "bg-amber-50 border-l-4 border-amber-400",
  contract: "bg-green-50 border-l-4 border-green-600",
  done: "bg-orange-50 border-l-4 border-orange-400",
  rescheduled: "bg-purple-50 border-l-4 border-purple-500 opacity-85",
  canceled: "bg-red-50 border-l-4 border-red-500 opacity-75",
};

/** 닫힌 미팅 줄 — 상자 없이 아래 구분선. 변경·취소는 흐리게(기존 카드와 동일). */
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

/** 한국어 라벨. */
export const CARD_LABEL: Record<CardState, string> = {
  reserved: "예약",
  contract: "계약",
  done: "완료(계약X)",
  rescheduled: "변경됨",
  canceled: "취소",
};
