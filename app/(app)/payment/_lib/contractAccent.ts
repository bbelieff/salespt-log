/**
 * 계약 진행상태 → 강조색 패밀리 (마스터-디테일 "이어지는 윤곽선" + 카드 open 색).
 *
 * borderClass(좌측바) 로직과 동일 기준을 공유 — 선택 카드와 우측 상세 패널이
 * **같은 상태색**으로 하나의 윤곽선을 이루게 page 와 ContractRow 가 함께 사용.
 *   - 완료(체크 전부 + 평균 진행률 100%) = green
 *   - 진행 중 활성 슬롯 = teal(1)/cyan(2)/fuchsia(3)
 *   - 진행 전 = slate(중립)
 */
import type { ContractPayment } from "@/types";
import { checkedCount, TOTAL_CHECKBOXES } from "../_components/CheckboxList";

export type AccentFamily = "green" | "teal" | "cyan" | "fuchsia" | "slate";

type Slot = ContractPayment["수납1"];

function pct(p: string): number {
  return !p || p === "0%" ? 0 : parseInt(p, 10);
}

function hasData(s: Slot): boolean {
  return Boolean(
    s.진행기관 ||
      s.현황 ||
      s.수납일 ||
      s.승인금액 > 0 ||
      s.수납액 > 0 ||
      (s.진행률 && s.진행률 !== "0%"),
  );
}

function visibleCount(cp: ContractPayment): 1 | 2 | 3 {
  if (hasData(cp.수납3)) return 3;
  if (hasData(cp.수납2)) return 2;
  return 1;
}

export function contractAccentFamily(cp: ContractPayment): AccentFamily {
  const slots: Slot[] = [cp.수납1, cp.수납2, cp.수납3];
  const vis = visibleCount(cp);
  const visSlots = slots.slice(0, vis);
  const avg = visSlots.length
    ? Math.round(visSlots.reduce((s, x) => s + pct(x.진행률), 0) / visSlots.length)
    : 0;
  const isComplete =
    checkedCount(cp) === TOTAL_CHECKBOXES && vis >= 1 && avg >= 100;
  if (isComplete) return "green";
  const fam = ["teal", "cyan", "fuchsia"] as const;
  for (let i = vis - 1; i >= 0; i--) {
    if (pct(visSlots[i]?.진행률 ?? "") > 0) return fam[i] ?? "slate";
  }
  return "slate";
}

/** 📋 서류 진행 뱃지 색 — 전부 완료 green / 0건 회색 / 진행 중 blue. */
export function docBadgeClass(done: number): string {
  if (done === TOTAL_CHECKBOXES) return "text-green-600 bg-green-50";
  return done === 0 ? "text-gray-400 bg-gray-50" : "text-blue-600 bg-blue-50";
}

/** 💰 수납 진행 뱃지 색 — 미착수 회색 / 완료 green / 진행 중 blue. */
export function payBadgeClass(avgPct: number): string {
  if (avgPct === 0) return "text-gray-400 bg-gray-50";
  return avgPct >= 100 ? "text-green-600 bg-green-50" : "text-blue-600 bg-blue-50";
}

/** 패밀리별 Tailwind 클래스 (전부 표준 토큰 — arbitrary value 없음). */
export const ACCENT: Record<
  AccentFamily,
  { border: string; tint: string; leftBar: string }
> = {
  green: { border: "border-green-500", tint: "bg-green-50/50", leftBar: "border-l-green-500" },
  teal: { border: "border-teal-500", tint: "bg-teal-50/50", leftBar: "border-l-teal-500" },
  cyan: { border: "border-cyan-500", tint: "bg-cyan-50/50", leftBar: "border-l-cyan-500" },
  fuchsia: { border: "border-fuchsia-500", tint: "bg-fuchsia-50/50", leftBar: "border-l-fuchsia-500" },
  slate: { border: "border-slate-400", tint: "bg-slate-50", leftBar: "border-l-slate-400" },
};
