import type { ContractPayment } from "@/types";
import { slotHasData } from "@/lib/analytics/payment-work-status";
import { compareWorkActivity } from "./payment-progress";
import { companyActivityKey, type InstitutionWorkItem } from "./institution-view";

export type PaymentSortKey = "date-asc" | "date-desc" | "dday";

export interface CompanyWorkItem {
  key: string;
  cp: ContractPayment;
  work: InstitutionWorkItem;
  hasProgress: boolean;
}

/** 저장된 진행 슬롯마다 한 행. 슬롯이 비어 있는 계약은 업체 단위 한 행만 남긴다. */
export function buildCompanyWorkItems(rows: ContractPayment[], works: InstitutionWorkItem[]): CompanyWorkItem[] {
  const contracts = new Map(rows.map((cp) => [companyActivityKey(cp), cp]));
  return works.flatMap((work) => {
    const cp = contracts.get(work.contractKey);
    if (!cp) return [];
    return [{ key: work.key, cp, work, hasProgress: slotHasData(cp[`수납${work.slot}`]) }];
  });
}

/** D-day: 진행 없음 → 날짜 없는 진행 → 최근 History → 임박 Todo. 동률은 저장 순서. */
export function sortCompanyWorkItems(items: CompanyWorkItem[], key: PaymentSortKey): CompanyWorkItem[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (key === "dday") {
      if (a.item.hasProgress !== b.item.hasProgress) return a.item.hasProgress ? 1 : -1;
      if (a.item.hasProgress) {
        const byActivity = compareWorkActivity(a.item.work, b.item.work);
        if (byActivity) return byActivity;
      }
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
