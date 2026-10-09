import { isTerminatedContract, type ContractPayment, type PaymentSlot, type Todo } from "@/types";
import { activityTodayISO, compareWorkActivity, progressPct } from "./payment-progress";
import { slotHasData } from "@/lib/analytics/payment-work-status";
import { normalizeInstitution } from "@/lib/util/institution-match";

export type WorkActivityKind = "none" | "history" | "todo";

export interface InstitutionWorkItem {
  key: string;
  contractKey: string;
  row: number | null;
  slot: 1 | 2 | 3;
  company: string;
  institution: string;
  product: string;
  progress: number;
  muted: boolean;
  activityKind: WorkActivityKind;
  activityDate: string;
  activityLabel: string;
}

export type WorkActivitySummary = Pick<InstitutionWorkItem, "activityKind" | "activityDate" | "activityLabel">;

export function companyActivityKey(cp: Pick<ContractPayment, "row" | "계약일" | "업체명">): string {
  return cp.row != null ? `row:${cp.row}` : `contract:${cp.계약일}|${cp.업체명}`;
}

/** 회사 대표도 목록과 같은 활동 우선순위를 적용한다. */
export function buildCompanyActivities(items: InstitutionWorkItem[], todayISO = activityTodayISO()): Map<string, WorkActivitySummary> {
  const byCompany = new Map<string, WorkActivitySummary>();
  for (const item of items) {
    const current = byCompany.get(item.contractKey);
    if (!current || compareWorkActivity(item, current, todayISO) < 0) byCompany.set(item.contractKey, item);
  }
  return byCompany;
}

export interface InstitutionGroup {
  institution: string;
  count: number;
  items: InstitutionWorkItem[];
}

const SLOTS = [1, 2, 3] as const;
const ko = new Intl.Collator("ko");
const DAY_MS = 86_400_000;

function dayDifference(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / DAY_MS);
}

function activityLabel(kind: WorkActivityKind, date: string, todayISO: string): string {
  if (kind === "none") return "D?";
  const days = dayDifference(todayISO, date);
  if (kind === "history") return `H+${String(Math.max(0, -days)).padStart(2, "0")}`;
  if (days === 0) return "D0";
  return `${days < 0 ? "D+" : "D-"}${String(Math.abs(days)).padStart(2, "0")}`;
}

function activityKey(contractRef: string, institution: string): string {
  return `${contractRef}\u0000${normalizeInstitution(institution)}`;
}

/** 슬롯의 저장된 기관명과 동일한 키로 Todo/History 를 연결한다. */
function activityDates(todos: Todo[]): Map<string, { todo: string; history: string }> {
  const dates = new Map<string, { todo: string; history: string }>();
  for (const record of todos) {
    if (!record.예정일자.trim()) continue;
    const key = activityKey(record.contractRef, record.institutionRef);
    const current = dates.get(key) ?? { todo: "", history: "" };
    if (record.기록종류 === "history") {
      if (record.예정일자 > current.history) current.history = record.예정일자;
    } else if (!record.완료여부 && (!current.todo || record.예정일자 < current.todo)) {
      current.todo = record.예정일자;
    }
    dates.set(key, current);
  }
  return dates;
}

function sortNamedLast(a: string, b: string): number {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return ko.compare(a, b);
}

/** 계약의 저장된 진행 슬롯을 기관→진행건으로 투영한다. 원본은 바꾸지 않는다. */
export function buildInstitutionWorkItems(
  rows: ContractPayment[], _courseStartISO = "", todos: Todo[] = [],
  todayISO = activityTodayISO(),
): InstitutionWorkItem[] {
  const out: InstitutionWorkItem[] = [];
  const dates = activityDates(todos);
  for (const cp of rows) {
    const populated = SLOTS.filter((slot) => slotHasData(cp[`수납${slot}`]));
    // 기관을 아직 입력하지 않은 계약도 목록에서 사라지지 않도록 진행 1에 둔다.
    const visible = populated.length ? populated : ([1] as const);
    for (const slot of visible) {
      const data: PaymentSlot = cp[`수납${slot}`];
      const storedInstitution = data.진행기관.trim();
      // 예전 자유입력은 "소진공 신취"처럼 상품을 기관 칸에 함께 적었다.
      // 보기에서만 분리한다. 원본 기관 키는 Todo/캘린더 연결을 위해 그대로 둔다.
      const legacyProduct = /^소진공\s+(.+)$/u.exec(storedInstitution)?.[1]?.trim() ?? "";
      const activity = dates.get(activityKey(`${cp.계약일}|${cp.업체명}`, storedInstitution));
      const kind: WorkActivityKind = activity?.todo ? "todo" : activity?.history ? "history" : "none";
      const date = kind === "todo" ? activity!.todo : kind === "history" ? activity!.history : "";
      out.push({
        key: `${cp.row ?? `${cp.계약일}|${cp.업체명}`}-${slot}`,
        contractKey: companyActivityKey(cp),
        row: cp.row ?? null,
        slot,
        company: cp.업체명,
        institution: legacyProduct ? "소진공" : storedInstitution,
        product: data.진행상품.trim() || legacyProduct,
        progress: progressPct(data.진행률),
        muted: isTerminatedContract(cp), // 해지만 흐림 — 이월은 또렷하게(2026-10-08)
        activityKind: kind,
        activityDate: date,
        activityLabel: activityLabel(kind, date, todayISO),
      });
    }
  }
  return out;
}

/** 검색은 업체·기관·상품 어느 쪽에서도 찾되, 그룹의 건수는 표시된 진행건 기준이다. */
export function groupInstitutionWorkItems(
  items: InstitutionWorkItem[],
  query = "",
  sortBy: "product" | "activity" = "product",
  todayISO = activityTodayISO(),
): InstitutionGroup[] {
  const needle = query.toLocaleLowerCase("ko").replace(/\s+/g, "");
  const groups = new Map<string, InstitutionWorkItem[]>();
  for (const item of items) {
    const haystack = `${item.institution}${item.product}${item.company}`
      .toLocaleLowerCase("ko").replace(/\s+/g, "");
    if (needle && !haystack.includes(needle)) continue;
    if (!groups.has(item.institution)) groups.set(item.institution, []);
    groups.get(item.institution)!.push(item);
  }
  return Array.from(groups, ([institution, matches]) => ({
    institution,
    count: matches.length,
    // 활동 정렬 동률은 입력(저장) 순서를 유지한다. 상품 정렬은 별도 선택에만 사용.
    items: [...matches].sort((a, b) =>
      sortBy === "activity" ? compareWorkActivity(a, b, todayISO) :
      sortNamedLast(a.product, b.product) || ko.compare(a.company, b.company) ||
      a.slot - b.slot || (a.row ?? 0) - (b.row ?? 0)),
  })).sort((a, b) => sortNamedLast(a.institution, b.institution));
}
