/**
 * 업체정보 보기 — 전체 / 적은 것 / 안 적은 것 (belie 2026-10-08).
 *
 * - 항목(EditorItem)마다 사람이 적는 칸 키를 모은다. 자동 계산 칸(비율·증가율·합계)과 숨은 칸은 세지 않는다.
 * - 전체: 묶음 안에서 적은 항목이 위, 안 적은 항목이 아래(원래 순서 유지).
 * - 적은 것 / 안 적은 것: 해당 항목만. 한 줄에 칸이 여럿이면(이름·주민번호 등) 하나라도 맞으면 보인다.
 * - 화면이 적는 도중에 움직이지 않도록, 호출하는 쪽이 편집기를 열 때의 값으로 한 번 계산해 고정한다.
 */
import type { CompanyInfo } from "@/types";
import { isCorporation } from "@/util/company-choice";
import { SALES_HALF_KEYS, SALES_YEAR_KEYS } from "@/util/company-sales";
import type { EditorItem } from "@/components/company-info-defs";

export const VIEW_MODES = ["all", "filled", "empty"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];
export const VIEW_LABEL: Record<ViewMode, string> = { all: "전체", filled: "적은 것", empty: "안 적은 것" };

type Key = keyof CompanyInfo;
const filledOf = (ci: CompanyInfo, k: Key) => String(ci[k] ?? "").trim() !== "";

/** 이 항목에서 사람이 적는 칸 키. 세지 않는 항목은 빈 배열. */
export function itemKeys(it: EditorItem, ci: CompanyInfo): Key[] {
  switch (it.kind) {
    case "field":
      if (it.onlyCorporation && !isCorporation(ci.사업자구분) && !filledOf(ci, it.def[0])) return [];
      return [it.def[0]];
    case "money":
      return [it.def[0]];
    case "row":
    case "pair":
      return it.defs.map((d) => d[0]);
    case "bizType":
      return ["사업자구분", "과세유형"];
    case "ownership":
      return [it.spec.key];
    case "sales":
    case "salesTotals":
      // 연도별 매출은 한 덩어리 — 해마다 합계 또는 반기 중 하나라도 있으면 그 해는 적은 것.
      return [...SALES_YEAR_KEYS];
    default:
      return [];
  }
}

function keyFilled(ci: CompanyInfo, k: Key): boolean {
  const year = (SALES_YEAR_KEYS as readonly string[]).indexOf(k);
  if (year >= 0) return filledOf(ci, k) || SALES_HALF_KEYS[year]!.some((h) => filledOf(ci, h));
  return filledOf(ci, k);
}

export interface ItemState { counted: boolean; anyFilled: boolean; anyEmpty: boolean; filled: number; empty: number }

export function itemState(it: EditorItem, ci: CompanyInfo): ItemState {
  const keys = itemKeys(it, ci);
  const filled = keys.filter((k) => keyFilled(ci, k)).length;
  return { counted: keys.length > 0, anyFilled: filled > 0, anyEmpty: filled < keys.length, filled, empty: keys.length - filled };
}

/** 보기에 맞춰 보일 항목의 원래 번호 목록(순서 포함). 세지 않는 항목(자동 비율 등)은 전체에서만, 맨 끝에. */
export function visibleItems(items: EditorItem[], ci: CompanyInfo, mode: ViewMode): number[] {
  const states = items.map((it) => itemState(it, ci));
  const idx = items.map((_, i) => i);
  if (mode === "filled") return idx.filter((i) => states[i]!.counted && states[i]!.anyFilled);
  if (mode === "empty") return idx.filter((i) => states[i]!.counted && states[i]!.anyEmpty);
  const counted = idx.filter((i) => states[i]!.counted);
  return [
    ...counted.filter((i) => states[i]!.anyFilled),
    ...counted.filter((i) => !states[i]!.anyFilled),
    ...idx.filter((i) => !states[i]!.counted),
  ];
}

/** 칸 개수 — [적은 것, 안 적은 것]. */
export function countFields(groups: EditorItem[][], ci: CompanyInfo): [number, number] {
  let filled = 0;
  let empty = 0;
  for (const it of groups.flat()) {
    const s = itemState(it, ci);
    filled += s.filled;
    empty += s.empty;
  }
  return [filled, empty];
}

/**
 * 기본보기에서 안 보이는데 값이 적힌 칸 수(belie 2026-10-09 — "확장보기에 적힌 항목 N개 더 있어요").
 * groups = 확장보기 전체 묶음, basic = 기본보기 묶음. 칸(저장 키) 단위로 센다.
 */
export function hiddenFilledCount(groups: EditorItem[][], basic: EditorItem[][], ci: CompanyInfo): number {
  const shown = new Set(basic.flat().flatMap((it) => itemKeys(it, ci)));
  const seen = new Set<Key>();
  let n = 0;
  for (const it of groups.flat()) {
    for (const k of itemKeys(it, ci)) {
      if (shown.has(k) || seen.has(k)) continue;
      seen.add(k);
      if (keyFilled(ci, k)) n++;
    }
  }
  return n;
}

