import { isCarryoverContract, isTerminatedContract, type ContractPayment, type PaymentSlot } from "@/types";
import { progressPct } from "./payment-progress";
import { slotHasData } from "@/lib/analytics/payment-work-status";

export interface InstitutionWorkItem {
  key: string;
  row: number | null;
  slot: 1 | 2 | 3;
  company: string;
  institution: string;
  product: string;
  progress: number;
  muted: boolean;
}

export interface InstitutionGroup {
  institution: string;
  count: number;
  items: InstitutionWorkItem[];
}

const SLOTS = [1, 2, 3] as const;
const ko = new Intl.Collator("ko");

function sortNamedLast(a: string, b: string): number {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return ko.compare(a, b);
}

/** 계약의 저장된 진행 슬롯을 기관→진행건으로 투영한다. 원본은 바꾸지 않는다. */
export function buildInstitutionWorkItems(rows: ContractPayment[], courseStartISO = ""): InstitutionWorkItem[] {
  const out: InstitutionWorkItem[] = [];
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
      out.push({
        key: `${cp.row ?? `${cp.계약일}|${cp.업체명}`}-${slot}`,
        row: cp.row ?? null,
        slot,
        company: cp.업체명,
        institution: legacyProduct ? "소진공" : storedInstitution,
        product: data.진행상품.trim() || legacyProduct,
        progress: progressPct(data.진행률),
        muted: isCarryoverContract(cp, courseStartISO) || isTerminatedContract(cp),
      });
    }
  }
  return out;
}

/** 검색은 업체·기관·상품 어느 쪽에서도 찾되, 그룹의 건수는 표시된 진행건 기준이다. */
export function groupInstitutionWorkItems(
  items: InstitutionWorkItem[],
  query = "",
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
    // 상품은 별도 계층이 아니라 기관 내부의 정렬 기준이다.
    items: [...matches].sort((a, b) =>
      sortNamedLast(a.product, b.product) || ko.compare(a.company, b.company) ||
      a.slot - b.slot || (a.row ?? 0) - (b.row ?? 0)),
  })).sort((a, b) => sortNamedLast(a.institution, b.institution));
}
