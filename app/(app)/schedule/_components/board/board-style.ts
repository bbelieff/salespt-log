/** 주간 보드 색 — tokens.md 미팅 5상태·채널 4색·실무 진회색·일반 청록을 Tailwind 클래스로. */
import type { Channel, MeetingState } from "@/types";

export type LayerKey = "meet" | "todo" | "event";
export type Layers = Record<LayerKey, boolean>;

export const LAYER_DOT: Record<LayerKey, string> = { meet: "bg-amber-500", todo: "bg-slate-700", event: "bg-teal-600" };
export const LAYER_LABEL: Record<LayerKey, string> = { meet: "미팅", todo: "실무", event: "일반" };

export const CH_DOT: Record<Channel, string> = {
  매입DB: "bg-blue-700", 직접생산: "bg-green-700", 현수막: "bg-amber-700", "콜·지·기·소": "bg-violet-600",
};

/** 폰 월 보기 일정 줄의 왼쪽 띠 — 채널 색. */
export const CH_EDGE: Record<Channel, string> = {
  매입DB: "border-l-blue-700", 직접생산: "border-l-green-700", 현수막: "border-l-amber-700", "콜·지·기·소": "border-l-violet-600",
};

/** 시간 칸 블록 — 상태색 옅은 바탕 + 테두리, 글자는 같은 색 진한 단계. 변경은 점선·흐림, 취소는 흐림. */
export const ST_BLOCK: Record<MeetingState, { box: string; text: string }> = {
  예약: { box: "border-amber-300 bg-amber-50/75", text: "text-amber-800" },
  계약: { box: "border-green-400 bg-green-50/75", text: "text-green-800" },
  완료: { box: "border-orange-300 bg-orange-50/75", text: "text-orange-800" },
  변경: { box: "border-dashed border-purple-300 bg-purple-50/75 opacity-85", text: "text-purple-800" },
  취소: { box: "border-red-200 bg-red-50/75 opacity-70", text: "text-red-700" },
};

export const ST_BAR: Record<MeetingState, string> = {
  예약: "bg-amber-400", 계약: "bg-green-600", 완료: "bg-orange-400", 변경: "bg-purple-500", 취소: "bg-red-500",
};
