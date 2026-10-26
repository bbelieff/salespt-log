/**
 * STEP 배지 — 사이드 탭(DesktopNav)과 같은 모양·색(2026-10-26 belie 「사이드탭의 스탭과 동일한 이미지로」).
 * 1 파랑 · 1.5 파랑→초록 · 2 초록 · 3 보라 · 4 빨강. 옆에 같은 글자가 이미 읽히는 곳(사이드 탭)은 aria-hidden.
 */
export type StepId = "1" | "1.5" | "2" | "3" | "4";

export const STEP_BADGE_CLASS: Record<StepId, string> = {
  "1": "bg-blue-100 text-blue-800",
  "1.5": "bg-gradient-to-b from-blue-100 to-emerald-100 text-teal-800",
  "2": "bg-emerald-100 text-emerald-800",
  "3": "bg-violet-100 text-violet-800",
  "4": "bg-rose-100 text-rose-800",
};

export default function StepBadge({ step, className = "", "aria-hidden": ariaHidden }: { step: StepId; className?: string; "aria-hidden"?: boolean }) {
  return <span aria-hidden={ariaHidden} className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-bold ${STEP_BADGE_CLASS[step]} ${className}`}>STEP {step}</span>;
}
