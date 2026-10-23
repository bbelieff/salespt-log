import { DB_SHEET_QUALIFIED_RESULTS } from "@/types/db-sheet";

/** 컨택결과(results)로 거르는 칩과 현재상태(stages)로 거르는 칩. 장기관리는 결과가 아니라 상태다. */
export const STATUS_FILTERS = [
  { id: "uncontacted", label: "미컨택", results: ["미컨택"], stages: [] },
  { id: "absent", label: "부재", results: ["부재"], stages: [] },
  { id: "simple-refusal", label: "단순거절", results: ["단순거절"], stages: [] },
  { id: "recall", label: "재통화", results: ["재통화"], stages: [] },
  { id: "progress", label: "미팅예약·컨택 후 거절", results: DB_SHEET_QUALIFIED_RESULTS, stages: [] },
  { id: "as-planned", label: "AS신청", results: ["AS예정"], stages: [] },
  { id: "long-term", label: "장기관리", results: [], stages: ["장기관리"] },
] as const;

export type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"];

type FilterableDbSheetRow = {
  company: string;
  owner: string;
  phone: string;
  supplier: string;
  date: string;
  result: string;
  stage?: string;
};

export type DbSheetViewFilters = {
  selectedStatuses: readonly StatusFilterId[];
  search?: string;
  supplier?: string;
  selectedSuppliers?: readonly string[];
  from?: string;
  to?: string;
};

const resultsByStatus = new Map<StatusFilterId, readonly string[]>(
  STATUS_FILTERS.map(filter => [filter.id, filter.results]),
);
const stagesByStatus = new Map<StatusFilterId, readonly string[]>(
  STATUS_FILTERS.map(filter => [filter.id, filter.stages]),
);

function uniqueStatuses(selected: readonly StatusFilterId[]): StatusFilterId[] {
  return [...new Set(selected)];
}

export function hasStatusRestriction(selected: readonly StatusFilterId[]): boolean {
  const count = uniqueStatuses(selected).length;
  return count > 0 && count < STATUS_FILTERS.length;
}

export function toggleStatusFilter(
  selected: readonly StatusFilterId[],
  id: StatusFilterId,
): StatusFilterId[] {
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}

export function filterDbSheetRows<T extends FilterableDbSheetRow>(
  rows: readonly T[],
  filters: DbSheetViewFilters,
): T[] {
  const selected = uniqueStatuses(filters.selectedStatuses);
  const restrictStatus = hasStatusRestriction(selected);
  const acceptedResults = restrictStatus
    ? new Set(selected.flatMap(id => resultsByStatus.get(id) ?? []))
    : null;
  const acceptedStages = new Set(restrictStatus ? selected.flatMap(id => stagesByStatus.get(id) ?? []) : []);
  const search = filters.search ?? "";
  const supplier = filters.supplier ?? "";
  const from = filters.from ?? "";
  const to = filters.to ?? "";

  return rows.filter(row =>
    (!search || [row.company, row.owner, row.phone].some(value => value.includes(search)))
    && (!supplier || row.supplier === supplier)
    && (!filters.selectedSuppliers?.length || filters.selectedSuppliers.includes(row.supplier))
    && (!from || row.date >= from)
    && (!to || row.date <= to)
    && (!acceptedResults || acceptedResults.has(row.result) || acceptedStages.has(row.stage ?? "")),
  );
}
