/**
 * CarryoverBadge — 이월(arena-carryover §5) 행 표시. 구분!=="이월" 이면 null.
 * badge: 작은 회색 "이월" 뱃지. note: "아레나 점수 미포함" 한 줄 문구.
 */
"use client";

export default function CarryoverBadge({
  구분,
  variant = "badge",
}: {
  구분?: string;
  variant?: "badge" | "note";
}) {
  if (구분 !== "이월") return null;
  if (variant === "note") {
    return (
      <p className="text-[11px] text-gray-400">
        ↩ 이월 — 이 건은 아레나 점수에 들어가지 않습니다.
      </p>
    );
  }
  return (
    <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
      이월
    </span>
  );
}
