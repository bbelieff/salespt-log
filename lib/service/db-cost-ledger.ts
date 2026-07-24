/** Layer: service — 03 DB관리 자동 비용을 읽기 전용 원장 행으로 투영한다. */
import type { DBOverview } from "@/service/db";
import type {
  RecognizedExpense,
} from "@/types/expense-ledger";

type SystemExpenseCategoryId = "system:db_purchase" | "system:db_production" | "system:db_banner";

export const SYSTEM_EXPENSE_CATEGORIES: Record<
  SystemExpenseCategoryId,
  { categoryName: string; source: "db_purchase" | "db_production" | "db_banner" }
> = {
  "system:db_purchase": { categoryName: "매입DB", source: "db_purchase" },
  "system:db_production": { categoryName: "직접생산", source: "db_production" },
  "system:db_banner": { categoryName: "현수막", source: "db_banner" },
};

export interface DbCostLedgerRange {
  view: "month" | "all" | "category";
  from: string;
  through: string;
  categoryId?: string;
}

function parseUtc(iso: string): Date { return new Date(`${iso}T00:00:00Z`); }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseUtc(value);
  return !Number.isNaN(parsed.getTime()) && iso(parsed) === value;
}
function dayCount(start: string, end: string): number {
  return Math.floor((parseUtc(end).getTime() - parseUtc(start).getTime()) / 86_400_000) + 1;
}
function won(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return number > 0 ? number : 0;
}

/** 양끝 포함, 나머지 원은 앞선 달력일에 배정한다. */
export function allocateAmountByDay(amountWon: number, periodStart: string, periodEnd: string): Array<{ date: string; amountWon: number }> {
  const days = dayCount(periodStart, periodEnd);
  if (days < 1 || days > 3660) throw new Error("expense_invalid_period");
  const quotient = Math.floor(amountWon / days);
  const remainder = amountWon % days;
  const out: Array<{ date: string; amountWon: number }> = [];
  const date = parseUtc(periodStart);
  for (let index = 0; index < days; index += 1) {
    out.push({ date: iso(date), amountWon: quotient + (index < remainder ? 1 : 0) });
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return out;
}

function inRange(date: string, range: DbCostLedgerRange): boolean {
  return date >= range.from && date <= range.through;
}
function categoryIncluded(categoryId: SystemExpenseCategoryId, range: DbCostLedgerRange): boolean {
  return range.view !== "category" || range.categoryId === categoryId;
}
function systemEntry(input: {
  source: "db_purchase" | "db_production" | "db_banner";
  row: number;
  categoryId: SystemExpenseCategoryId;
  itemName: string;
  amountWon: number;
  periodStart: string;
  periodEnd: string;
  recognitionStatus: RecognizedExpense["recognitionStatus"];
  recognitionNote: string;
}): RecognizedExpense {
  return {
    source: input.source,
    id: `${input.source}:${input.row}`,
    categoryId: input.categoryId,
    categoryName: SYSTEM_EXPENSE_CATEGORIES[input.categoryId].categoryName,
    itemName: input.itemName,
    amountWon: input.amountWon,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    system: true,
    readOnly: true,
    recognitionStatus: input.recognitionStatus,
    recognitionNote: input.recognitionNote,
  };
}

/** loadDBOverview가 이미 DB-primary + sheet union/fallback 및 row 중복 제거를 맡는다. */
export function recognizeDbCostEntries(
  overview: Pick<DBOverview, "purchases" | "productions" | "banners">,
  range: DbCostLedgerRange,
): RecognizedExpense[] {
  const entries: RecognizedExpense[] = [];
  const purchaseCategory = "system:db_purchase" as const;
  const productionCategory = "system:db_production" as const;
  const bannerCategory = "system:db_banner" as const;

  if (categoryIncluded(purchaseCategory, range)) {
    for (const purchase of overview.purchases) {
      const amountWon = won(purchase.주문금액 ?? purchase.개당단가 * purchase.주문개수);
      if (amountWon < 1 || !isValidIsoDate(purchase.구매일) || !inRange(purchase.구매일, range)) continue;
      entries.push(systemEntry({
        source: "db_purchase", row: purchase.row, categoryId: purchaseCategory,
        itemName: purchase.업체명.trim() || "매입DB 구매", amountWon,
        periodStart: purchase.구매일, periodEnd: purchase.구매일,
        recognitionStatus: "recognized_on_date", recognitionNote: "구매일에 주문금액 전액을 인식했습니다.",
      }));
    }
  }

  if (categoryIncluded(productionCategory, range)) {
    for (const production of overview.productions) {
      const amountWon = won(production.기간예산);
      if (amountWon < 1) continue;
      const itemName = production.소재.trim() || "직접생산";
      const validStart = isValidIsoDate(production.시작일);
      const validEnd = isValidIsoDate(production.종료일) && production.종료일 >= production.시작일;
      if (!validStart) {
        if (range.view !== "month") entries.push(systemEntry({
          source: "db_production", row: production.row, categoryId: productionCategory,
          itemName, amountWon, periodStart: "", periodEnd: "",
          recognitionStatus: "unallocated", recognitionNote: "시작일이 없거나 올바르지 않아 월에는 배분하지 않고 전체·카테고리에 한 번 포함했습니다.",
        }));
        continue;
      }
      if (!validEnd) {
        if (inRange(production.시작일, range)) entries.push(systemEntry({
          source: "db_production", row: production.row, categoryId: productionCategory,
          itemName, amountWon, periodStart: production.시작일, periodEnd: production.시작일,
          recognitionStatus: "recognized_on_start", recognitionNote: "종료일이 없거나 올바르지 않아 시작일에 기간예산 전액을 한 번 인식했습니다.",
        }));
        continue;
      }
      const recognized = allocateAmountByDay(amountWon, production.시작일, production.종료일)
        .reduce((sum, allocation) => sum + (inRange(allocation.date, range) ? allocation.amountWon : 0), 0);
      if (recognized > 0) entries.push(systemEntry({
        source: "db_production", row: production.row, categoryId: productionCategory,
        itemName, amountWon: recognized, periodStart: production.시작일, periodEnd: production.종료일,
        recognitionStatus: "allocated", recognitionNote: "시작일과 종료일을 포함한 기간에 일할 인식했습니다.",
      }));
    }
  }

  if (categoryIncluded(bannerCategory, range)) {
    for (const banner of overview.banners) {
      const amountWon = won(banner.주문금액 ?? banner.개당단가 * banner.주문개수);
      if (amountWon < 1 || !isValidIsoDate(banner.날짜) || !inRange(banner.날짜, range)) continue;
      entries.push(systemEntry({
        source: "db_banner", row: banner.row, categoryId: bannerCategory,
        itemName: banner.업체명.trim() || "현수막", amountWon,
        periodStart: banner.날짜, periodEnd: banner.날짜,
        recognitionStatus: "recognized_on_date", recognitionNote: "날짜에 주문금액 전액을 인식했습니다.",
      }));
    }
  }

  return entries;
}
