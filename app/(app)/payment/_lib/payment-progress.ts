/**
 * 계약 카드 진행도·슬롯 가시성 및 활동 날짜 순수 헬퍼.
 */
import type { ContractPayment } from "@/types";

type Slot = ContractPayment["수납1"];

/** 자동 저장 coherent 그룹 검증 — 금액 유한·0이상, 수납일 빈값/YYYY-MM-DD. */
export function validContractDraft(d: ContractPayment): boolean {
  if (!Number.isFinite(d.수임비) || d.수임비 < 0) return false;
  for (const s of [d.수납1, d.수납2, d.수납3]) {
    if (!Number.isFinite(s.승인금액) || s.승인금액 < 0) return false;
    if (!Number.isFinite(s.수납액) || s.수납액 < 0) return false;
    if (s.수납일 !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(s.수납일)) return false;
  }
  return true;
}

/** 연동 필드 변경분 — 바뀐 키만 전송(동일값 재전송=중복 저장 방지). */
export interface LinkedFieldDelta {
  계약일?: string;
  업체명?: string;
  수임비?: number;
}
export function linkedNext(
  base: { 계약일: string; 업체명: string; 수임비: number },
  draft: { 계약일: string; 업체명: string; 수임비: number },
): LinkedFieldDelta {
  const next: LinkedFieldDelta = {};
  if (draft.업체명.trim() !== base.업체명) next.업체명 = draft.업체명.trim();
  if (draft.계약일 !== base.계약일) next.계약일 = draft.계약일;
  if (draft.수임비 !== base.수임비) next.수임비 = draft.수임비;
  return next;
}

/** 빈 슬롯 — 수납 회차 제거 시 덮어쓸 값(시트 M~AD 대응 6필드 + 메모). */
export const EMPTY_SLOT: Slot = {
  진행기관: "",
  진행상품: "",
  진행률: "",
  현황: "",
  승인금액: 0,
  수납액: 0,
  수납일: "",
  메모: "",
};

/** 진행률 문자열("80%"/"0%"/"") → 숫자(%). */
export function progressPct(p: string): number {
  if (!p || p === "0%") return 0;
  return parseInt(p, 10) || 0;
}

/** 슬롯에 의미있는 데이터가 있는지 (visiblePayments 초기값 계산용). */
export function hasSlotData(slot: Slot): boolean {
  return Boolean(
    slot.진행기관 ||
      slot.진행상품 ||
      slot.현황 ||
      slot.수납일 ||
      slot.승인금액 > 0 ||
      slot.수납액 > 0 ||
      (slot.진행률 && slot.진행률 !== "0%"),
  );
}

/** 데이터 기반 초기 보이는 슬롯 수 — 슬롯3 데이터 있으면 3, 슬롯2 있으면 2, else 1. */
export function initialVisiblePayments(cp: ContractPayment): 1 | 2 | 3 {
  if (hasSlotData(cp.수납3)) return 3;
  if (hasSlotData(cp.수납2)) return 2;
  return 1;
}

/** 계약 진행도(%) — 보이는 슬롯 진행률 평균. 정렬·표시 공용. */
export function contractProgress(cp: ContractPayment): number {
  const n = initialVisiblePayments(cp);
  const slots = [cp.수납1, cp.수납2, cp.수납3].slice(0, n);
  if (!slots.length) return 0;
  return Math.round(
    slots.reduce((s, sl) => s + progressPct(sl.진행률), 0) / slots.length,
  );
}

export interface ActivitySortValue {
  activityKind: "none" | "history" | "todo";
  activityDate: string;
}

/** D-?? → 최근 History → 임박 Todo. 조회 전 활동은 미기록으로 취급한다. */
export function compareWorkActivity(a?: ActivitySortValue, b?: ActivitySortValue): number {
  const priority = { none: 0, history: 1, todo: 2 };
  const aKind = a?.activityKind ?? "none";
  const bKind = b?.activityKind ?? "none";
  const category = priority[aKind] - priority[bKind];
  if (category) return category;
  if (aKind === "history") return (b?.activityDate ?? "").localeCompare(a?.activityDate ?? "");
  if (aKind === "todo") return (a?.activityDate ?? "").localeCompare(b?.activityDate ?? "");
  return 0;
}
