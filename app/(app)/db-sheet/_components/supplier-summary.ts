/**
 * DB관리시트 「공급처별 성과」 집계 — 순수 함수(React·저장소 호출 없음). 화면은 SupplierSummary.tsx.
 * 입력은 화면이 이미 가진 leads 와 유입일 기간뿐이다. 검색어·공급처 선택은 일부러 무시해 공급처끼리 비교가 유지된다.
 * 단계는 서버가 붙인 lead.funnel(lib/service/db-sheet-status.ts dbSheetFunnelStep)을 그대로 누적해 센다.
 */
import { DbSheetFunnelStep, type DbSheetLead } from "@/types/db-sheet";

/** 계약률 1위·회색 처리를 판단하는 최소 표본(들어온 DB 수). 바꾸면 한 줄 문구·회색 기준이 함께 바뀐다. */
export const SUPPLIER_MIN_SAMPLE = 20;
/** 처음에 보여 줄 공급처 줄 수(공급처 미입력 줄은 세지 않고 늘 맨 끝). */
export const SUPPLIER_TOP_LIMIT = 8;
export const BLANK_SUPPLIER_LABEL = "공급처 미입력";

type Channel = DbSheetLead["channel"];
const CHANNEL_ORDER: readonly Channel[] = ["매입DB", "직접생산"];
const STEP = Object.fromEntries(DbSheetFunnelStep.options.map((step, index) => [step, index])) as Record<DbSheetFunnelStep, number>;

export type SupplierRow = {
  /** 원래 공급처 글자 그대로(필터와 같은 비교). "" = 공급처 미입력. */
  supplier: string;
  label: string;
  channels: Channel[];
  total: number;
  /** 아직 아무 결과도 적지 않은 DB(미컨택). 저장 응답 전이라 단계가 없는 행도 여기에 센다. */
  untouched: number;
  consulted: number;
  meetings: number;
  contracts: number;
};
/** 한 줄 요약. name 이 있으면 화면이 굵게 보여 준다: before + ‘name’ + after. */
export type SupplierHeadline = { before: string; name?: string; after: string };
export type SupplierSummaryData = { rows: SupplierRow[]; total: SupplierRow; best: string | null; headline: SupplierHeadline };

/** 비율 한 자리. 분모 0 이면 「—」. */
export function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";
}

/** 유입일 기간(양 끝 포함, 빈 값 = 제한 없음) — DB 목록 필터(page.tsx)와 같은 비교. */
export function inInflowRange(date: string, from: string, to: string): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

function emptyRow(supplier: string, label = supplier || BLANK_SUPPLIER_LABEL): SupplierRow {
  return { supplier, label, channels: [], total: 0, untouched: 0, consulted: 0, meetings: 0, contracts: 0 };
}

function count(row: SupplierRow, lead: DbSheetLead) {
  const step = lead.funnel ? STEP[lead.funnel] : STEP.유입;
  row.total += 1;
  if (step === STEP.유입) row.untouched += 1;
  if (step >= STEP.상담) row.consulted += 1;
  if (step >= STEP.미팅) row.meetings += 1;
  if (step >= STEP.계약) row.contracts += 1;
  if (!row.channels.includes(lead.channel)) row.channels.push(lead.channel);
}

/** 들어온 DB 많은 순 → 공급처 이름순, 공급처 미입력은 늘 마지막. */
function compareRows(a: SupplierRow, b: SupplierRow): number {
  if (!a.supplier !== !b.supplier) return a.supplier ? -1 : 1;
  return b.total - a.total || a.supplier.localeCompare(b.supplier, "ko");
}

/** 비율 큰 순(나눗셈 없이 비교) → 건수 많은 순 → 들어온 DB 많은 순 → 이름순. */
function leader(rows: SupplierRow[], pick: (row: SupplierRow) => number): SupplierRow | undefined {
  return [...rows].sort((a, b) =>
    pick(b) * a.total - pick(a) * b.total || pick(b) - pick(a) || b.total - a.total || a.supplier.localeCompare(b.supplier, "ko"),
  )[0];
}

function headlineFor(rows: SupplierRow[], periodSet: boolean): { best: string | null; headline: SupplierHeadline } {
  const pool = rows.filter(row => row.supplier && row.total >= SUPPLIER_MIN_SAMPLE);
  if (!pool.length) {
    return { best: null, headline: { before: `공급처별 DB가 ${SUPPLIER_MIN_SAMPLE}건 이상 쌓이면 어디가 잘 맞는지 알려 드릴게요`, after: "" } };
  }
  const byContract = leader(pool, row => row.contracts)!;
  if (byContract.contracts > 0) {
    return { best: byContract.supplier, headline: {
      before: `${periodSet ? "이 기간" : "전체 기간"} 계약률 1위 공급처 `, name: byContract.supplier,
      after: ` · DB ${byContract.total}건 중 계약 ${byContract.contracts}건`,
    } };
  }
  const byConsult = leader(pool, row => row.consulted)!;
  if (byConsult.consulted > 0) {
    return { best: null, headline: {
      before: "아직 계약한 공급처는 없어요 · 상담률 1위 ", name: byConsult.supplier,
      after: ` (${pct(byConsult.consulted, byConsult.total)})`,
    } };
  }
  return { best: null, headline: { before: "아직 상담까지 간 DB가 없어요", after: "" } };
}

export function summarizeSuppliers(leads: readonly DbSheetLead[], range: { from: string; to: string }): SupplierSummaryData {
  const groups = new Map<string, SupplierRow>();
  const total = emptyRow("", "합계");
  for (const lead of leads) {
    if (!inInflowRange(lead.date, range.from, range.to)) continue;
    let row = groups.get(lead.supplier);
    if (!row) { row = emptyRow(lead.supplier); groups.set(lead.supplier, row); }
    count(row, lead);
    count(total, lead);
  }
  const rows = [...groups.values()].sort(compareRows);
  for (const row of [...rows, total]) row.channels.sort((a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b));
  return { rows, total, ...headlineFor(rows, !!(range.from || range.to)) };
}

/** 화면 낭독·테스트용 한 줄 글자. */
export function headlineText(headline: SupplierHeadline): string {
  return headline.name === undefined ? headline.before + headline.after : `${headline.before}‘${headline.name}’${headline.after}`;
}

/**
 * 처음엔 위 SUPPLIER_TOP_LIMIT 곳만. 선택한 공급처가 그 밖이면 함께 보여 준다(선택 표시가 숨지 않게).
 * 공급처 미입력 줄은 세지 않고 따로 돌려준다(누를 수 없는 줄, 늘 마지막).
 */
export function visibleSupplierRows(rows: SupplierRow[], selected: string, expanded: boolean): { shown: SupplierRow[]; blank: SupplierRow | null; hidden: number } {
  const named = rows.filter(row => row.supplier);
  const blank = rows.find(row => !row.supplier) ?? null;
  if (expanded || named.length <= SUPPLIER_TOP_LIMIT) return { shown: named, blank, hidden: 0 };
  const top = named.slice(0, SUPPLIER_TOP_LIMIT);
  const extra = named.slice(SUPPLIER_TOP_LIMIT).find(row => row.supplier === selected);
  const shown = extra ? [...top, extra] : top;
  return { shown, blank, hidden: named.length - shown.length };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function formatDay(iso: string, withYear: boolean): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const day = `${Number(m[2])}/${Number(m[3])}`;
  return withYear ? `${m[1]}/${day}` : day;
}

/** 기간 표시 칩: 「유입일 전체」·「유입일 10/1부터」·「유입일 10/12까지」·「유입일 10/1 ~ 10/12」(해가 다르면 연도 포함). */
export function periodLabel(from: string, to: string): string {
  if (!from && !to) return "유입일 전체";
  if (!to) return `유입일 ${formatDay(from, false)}부터`;
  if (!from) return `유입일 ${formatDay(to, false)}까지`;
  const crossYear = from.slice(0, 4) !== to.slice(0, 4);
  return `유입일 ${formatDay(from, crossYear)} ~ ${formatDay(to, crossYear)}`;
}
