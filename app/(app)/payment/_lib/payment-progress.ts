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

// 칸 규칙(입력됨·보일 칸 수·진행률)은 lib/analytics/contract-slots.ts 한 곳 — 기존 이름은 재수출로 유지.
export {
  progressPct,
  slotHasData as hasSlotData,
  visibleSlotCount as initialVisiblePayments,
  contractProgress,
} from "@/lib/analytics/contract-slots";

export interface ActivitySortValue {
  activityKind: "none" | "history" | "todo";
  activityDate: string;
}

export function activityTodayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 미지정 → 연체 Todo → 오늘 Todo → History → 미래 Todo. 동률은 저장 순서. */
export function compareWorkActivity(a?: ActivitySortValue, b?: ActivitySortValue, todayISO = activityTodayISO()): number {
  // 조회되지 않은 값은 실제 미지정으로 분류하지 않는다.
  if (!a || !b) return 0;
  const rank = (value: ActivitySortValue): number => {
    if (value.activityKind === "none" || !value.activityDate) return 0;
    if (value.activityKind === "history") return 3;
    return value.activityDate < todayISO ? 1 : value.activityDate === todayISO ? 2 : 4;
  };
  const category = rank(a) - rank(b);
  return category || (rank(a) === 0 ? 0 : a.activityDate.localeCompare(b.activityDate));
}
