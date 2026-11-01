/**
 * 상세 두 칸(업체정보 | 진행) 넓히기 전환 — 상세 배너 오른쪽(「진행 | 장기관리」 옆). 2026-11-01 belie.
 * 누를 때마다 업체정보 칸 최대 ↔ 진행 칸 최대를 번갈아 바꾸고, 목록 칸은 가장 좁게 돌린다(예전 「기본 너비」 자리).
 * 버튼 그림 = 지금 넓은 칸이 진하게 칠해진 두 칸 그림. 테두리는 예전 「기본 너비」 버튼과 같다.
 */
"use client";

export const DETAIL_SPLIT_MIN = 38;
export const DETAIL_SPLIT_MAX = 62;

/** 지금 업체정보(왼쪽) 칸이 넓은가 — 가운데(50%)보다 크면 업체정보 쪽. */
export const isInfoWide = (pct: number) => pct >= 50;
/** 다음 상태: 업체정보가 넓으면 진행 최대로, 아니면 업체정보 최대로. */
export const nextDetailSplit = (pct: number) => (isInfoWide(pct) ? DETAIL_SPLIT_MIN : DETAIL_SPLIT_MAX);
/** 강조할 칸 — 한쪽이 확실히 넓을 때(55% 이상 / 45% 이하, 기본 60% 포함). 가운데 근처만 강조 없음.
 *  넓힌 칸은 떠 보이고 좁힌 칸은 카드까지 연회색으로 가라앉는다(globals.css [data-split-focus]). */
export const SPLIT_FOCUS_EDGE = 55;
export const detailSplitFocus = (pct: number): "info" | "work" | "none" =>
  pct >= SPLIT_FOCUS_EDGE ? "info" : pct <= 100 - SPLIT_FOCUS_EDGE ? "work" : "none";

export default function DetailSplitToggle({ pct, onToggle }: { pct: number; onToggle: (next: number) => void }) {
  const infoWide = isInfoWide(pct);
  const label = infoWide ? "업체정보를 넓게 보는 중 — 누르면 진행을 넓게" : "진행을 넓게 보는 중 — 누르면 업체정보를 넓게";
  const left = infoWide ? 13 : 7;
  return (
    <button type="button" data-payment-detail-split={infoWide ? "info" : "work"} aria-label={label} title={label}
      onClick={() => onToggle(nextDetailSplit(pct))}
      className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white/80 px-2 text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
      <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" className="block">
        <rect x="0.75" y="0.75" width="22.5" height="14.5" rx="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2.5" y="2.5" width={left - 1} height="11" rx="1" fill="currentColor" opacity={infoWide ? 0.85 : 0.25} />
        <rect x={left + 2.5} y="2.5" width={19 - left} height="11" rx="1" fill="currentColor" opacity={infoWide ? 0.25 : 0.85} />
      </svg>
    </button>
  );
}
