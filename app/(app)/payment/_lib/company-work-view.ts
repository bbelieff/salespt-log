import type { ContractPayment } from "@/types";
import { slotHasData } from "@/lib/analytics/payment-work-status";
import { activityTodayISO, compareWorkActivity } from "./payment-progress";
import { companyActivityKey, type InstitutionWorkItem } from "./institution-view";

export type PaymentSortKey = "date-asc" | "date-desc" | "dday";

export interface CompanyWorkItem {
  /** 계약(업체) 키 — 업체 보기는 계약 한 건당 한 항목(belie 2026-09-29: 같은 업체가 진행건마다 두 번 보이던 문제). */
  key: string;
  cp: ContractPayment;
  /** 대표 진행건 — D-day 배지·정렬·선택 시 스크롤 기준(가장 급한 진행건, 없으면 첫 진행). */
  work: InstitutionWorkItem;
  /** 카드에 한 줄씩 보여 줄 진행건(진행 1→3 순). 진행이 없으면 빈 배열. */
  works: InstitutionWorkItem[];
  hasProgress: boolean;
}

/** 계약마다 한 항목. 진행이 여럿이면 works 에 모두 담고, 대표는 가장 급한 진행건. */
export function buildCompanyWorkItems(rows: ContractPayment[], works: InstitutionWorkItem[], todayISO = activityTodayISO()): CompanyWorkItem[] {
  const contracts = new Map(rows.map((cp) => [companyActivityKey(cp), cp]));
  const byContract = new Map<string, InstitutionWorkItem[]>();
  for (const work of works) {
    if (!contracts.has(work.contractKey)) continue;
    byContract.set(work.contractKey, [...(byContract.get(work.contractKey) ?? []), work]);
  }
  return [...byContract.entries()].map(([key, group]) => {
    const cp = contracts.get(key)!;
    const populated = group.filter((w) => slotHasData(cp[`수납${w.slot}`])).sort((a, b) => a.slot - b.slot);
    const primary = [...populated].sort((a, b) => compareWorkActivity(a, b, todayISO))[0] ?? group[0]!;
    return { key, cp, work: primary, works: populated, hasProgress: populated.length > 0 };
  });
}

/** 행 번호 → 업체 보기 항목 키(대시보드·업무현황 링크가 row·slot 으로 올 때). 행이 없으면 null. */
export function companyKeyOfRow(rows: ContractPayment[] | undefined, row: number | null | undefined): string | null {
  const cp = row == null ? undefined : rows?.find((r) => r.row === row);
  return cp ? companyActivityKey(cp) : null;
}

/** D-day: D? → 연체 Todo → 오늘 Todo → 오래된 History → 미래 Todo. 동률은 저장 순서. */
export function sortCompanyWorkItems(items: CompanyWorkItem[], key: PaymentSortKey, todayISO = activityTodayISO()): CompanyWorkItem[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (key === "dday") {
      const byActivity = compareWorkActivity(a.item.work, b.item.work, todayISO);
      if (byActivity) return byActivity;
    } else {
      const aDate = Date.parse(a.item.cp.계약일.trim());
      const bDate = Date.parse(b.item.cp.계약일.trim());
      const aValid = Number.isFinite(aDate);
      const bValid = Number.isFinite(bDate);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid && aDate !== bDate) return key === "date-asc" ? aDate - bDate : bDate - aDate;
    }
    return a.index - b.index;
  }).map(({ item }) => item);
}
