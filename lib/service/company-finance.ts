/**
 * Layer: service (순수 계산 — I/O 없음). 업체정보 [재무] 자동 계산 (company-finance-won-grid, belie 2026-09-28).
 *
 * 금액은 모두 백만원(lib/util/company-money.ts) — 계산은 십만원 정수(tenths)로 한다.
 *
 * - 연도별 매출 한 줄 = 상반기 | 하반기 | 합계. 반기 칸에 값이 있고 모두 읽히면 합계 = 반기 합(자동),
 *   한쪽만 있으면 그 반기만 더한다. 둘 다 비면 합계 칸은 직접 적는 칸(옛 연도 합계·재무제표 연 매출).
 *   반기 칸에 읽을 수 없는 글이 있으면 합계를 덮지 않는다.
 * - 매출증가율 3칸 = 줄 합계에서. 부채비율·이자보상배율·당기순이익률 = 재무 금액에서(결산연도 매출은
 *   기준 연도로 찾은 줄 합계).
 * - deriveCompanyInfo: 편집기 apply()(직접 입력·선택·문서 자동입력이 모두 지나는 한 곳)가 부른다.
 *   열기만 해서는 아무것도 저장하지 않는다 — 옛 행은 다음 편집 때 계산값이 함께 저장된다.
 *   · 반기 합계가 사용자가 적어 둔 다른 연도 합계를 덮으면 그 글을 업체 기타메모로 옮긴다(데이터 보존).
 *   · 기준 연도가 비었는데 재무 칸을 고치면 오늘 연도를 함께 저장한다.
 *   · 주민등록번호가 비었고 생년월일을 읽을 수 있으면 앞자리를 함께 저장한다.
 */
import {
  SALES_BASE_YEAR_KEY,
  SALES_GROWTH_DEFS,
  SALES_HALF_KEYS,
  SALES_YEAR_KEYS,
  formatGrowthRate,
  resolveBaseYear,
  salesSlotOf,
  salesYearTag,
  type SalesGrowthKey,
  type SalesHalfKey,
  type SalesYearKey,
} from "@/util/company-sales";
import {
  MONEY_KEYS,
  formatTenths,
  isSignedMoneyKey,
  moneyTenths,
  readMoney,
  type MoneyRead,
} from "@/util/company-money";
import { appendMemoLine } from "@/util/company-choice";
import { birthToRrnFront } from "@/util/rrn-front";

type Values = Partial<Record<string, unknown>>;
const text = (ci: Values, k: string) => String(ci[k] ?? "").trim();
const tenthsOf = (r: MoneyRead) => (r.kind === "empty" ? null : r.tenths);

// ── 연도별 매출 줄 ─────────────────────────────────────────────────────────

export type SalesRowView = {
  index: number;
  yearKey: SalesYearKey;
  halfKeys: readonly [SalesHalfKey, SalesHalfKey];
  halves: [MoneyRead, MoneyRead];
  yearly: MoneyRead;
  /** 합계 자동 — 반기 칸에 값이 있고 모두 읽힌다. */
  auto: boolean;
  /** 반기 칸에 읽을 수 없는 글이 있어 합계를 덮지 않는다. */
  blocked: boolean;
  /** 한쪽 반기만 있을 때 채운 쪽. */
  only: "상반기" | "하반기" | null;
  /** 계산에 쓰는 합계(십만원) — 자동이면 반기 합, 아니면 합계 칸을 읽은 값. */
  total: number | null;
  /** 자동인데 합계 칸에 금액이 다르거나 "6월" 같은 표시가 있는 글이 저장돼 있으면 그 글(이전에 적은 합계). */
  staleTotal: string;
};

export function salesRowView(ci: Values, index: number): SalesRowView {
  const halfKeys = SALES_HALF_KEYS[index]!;
  const yearKey = SALES_YEAR_KEYS[index]!;
  const halves: [MoneyRead, MoneyRead] = [readMoney(ci[halfKeys[0]]), readMoney(ci[halfKeys[1]])];
  const filled = halves.filter((h) => h.kind !== "empty");
  const blocked = filled.some((h) => tenthsOf(h) === null);
  const auto = filled.length > 0 && !blocked;
  const sum = auto ? filled.reduce((s, h) => s + (tenthsOf(h) ?? 0), 0) : null;
  const yearly = readMoney(ci[yearKey]);
  const stored = text(ci, yearKey);
  // 몇 월까지("26' 6월 100백만") 같은 표시는 금액이 같아도 덮으면 사라지는 정보다.
  const hasMonth = yearly.kind === "legacy" && yearly.month !== null;
  return {
    index,
    yearKey,
    halfKeys,
    halves,
    yearly,
    auto,
    blocked,
    only: auto && filled.length === 1 ? (halves[0].kind !== "empty" ? "상반기" : "하반기") : null,
    total: auto ? sum : tenthsOf(yearly),
    staleTotal: auto && stored !== "" && (tenthsOf(yearly) !== sum || hasMonth) ? stored : "",
  };
}

const ROWS = [0, 1, 2, 3] as const;

/** 자동 합계 줄의 합계 칸 값(정본 백만원). 자동이 아닌 줄은 넣지 않는다(직접 적은 값 유지). */
export function computeSalesTotals(ci: Values): Partial<Record<SalesYearKey, string>> {
  const out: Partial<Record<SalesYearKey, string>> = {};
  for (const i of ROWS) {
    const r = salesRowView(ci, i);
    if (r.auto && r.total !== null) out[r.yearKey] = formatTenths(r.total);
  }
  return out;
}

/** 줄 합계 → 매출증가율 3칸 값. 한쪽이 없거나 이전 해가 0 이하면 "". */
export function computeSalesGrowth(ci: Values): Record<SalesGrowthKey, string> {
  const totals = ROWS.map((i) => salesRowView(ci, i).total);
  const out = {} as Record<SalesGrowthKey, string>;
  for (const d of SALES_GROWTH_DEFS) {
    const from = totals[d.fromAgo];
    const to = totals[d.fromAgo - 1];
    out[d.key] = from !== null && from !== undefined && to !== null && to !== undefined ? formatGrowthRate(from, to) : "";
  }
  return out;
}

/** 매출증가율 3칸을 줄 합계에 맞게 다시 채운 사본. 바뀐 게 없으면 같은 객체. */
export function withSalesGrowth<T extends Values>(ci: T): T {
  const g = computeSalesGrowth(ci);
  const same = SALES_GROWTH_DEFS.every((d) => text(ci, d.key) === g[d.key]);
  return same ? ci : { ...ci, ...g };
}

/** Y(기준 연도) 가 한 해를 다 못 채운 매출이면 Y-1→Y 증가율에 붙일 안내, 아니면 "". */
export function partialYearNote(ci: Values): string {
  const r = salesRowView(ci, 0);
  if (r.auto && r.only === "상반기") return "올해(Y)는 상반기 매출만 있어 낮게 보일 수 있어요";
  const y = r.yearly;
  if (!r.auto && y.kind === "legacy" && y.month !== null && y.month < 12) {
    return `올해는 ${y.month}월까지 매출이라 낮게 보일 수 있어요`;
  }
  return "";
}

// ── 재무 비율 ──────────────────────────────────────────────────────────────

export const RATIO_KEYS = ["부채비율", "이자보상배율", "당기순이익률"] as const;
export type RatioKey = (typeof RATIO_KEYS)[number];

const oneDecimal = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toFixed(1);
};

/** 결산연도 글에서 네 자리 연도. */
function fiscalYearOf(raw: unknown): number | null {
  const m = String(raw ?? "").match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/**
 * 부채비율 = 부채총계 ÷ 자본총계 × 100 ("120.0%", 자본총계 0 이하면 "자본잠식")
 * 이자보상배율 = 영업이익 ÷ 이자비용 ("2.4배", 이자비용 없거나 0 이면 "")
 * 당기순이익률 = 당기순이익 ÷ 결산연도 매출(기준 연도로 찾은 줄 합계) × 100 ("3.0%", 매출 없으면 "")
 */
export function computeRatios(ci: Values, baseYear: number): Record<RatioKey, string> {
  const debt = moneyTenths(ci.부채총계);
  const equity = moneyTenths(ci.자본총계, true);
  const op = moneyTenths(ci.영업이익, true);
  const interest = moneyTenths(ci.이자비용);
  const net = moneyTenths(ci.당기순이익, true);
  const fy = fiscalYearOf(ci.결산연도);
  const slot = fy === null ? null : salesSlotOf(fy, baseYear);
  const sales = slot === null ? null : salesRowView(ci, slot).total;
  return {
    부채비율:
      equity !== null && equity <= 0
        ? "자본잠식"
        : debt !== null && equity !== null
          ? `${oneDecimal((debt / equity) * 100)}%`
          : "",
    이자보상배율: op !== null && interest !== null && interest !== 0 ? `${oneDecimal(op / interest)}배` : "",
    당기순이익률: net !== null && sales !== null && sales > 0 ? `${oneDecimal((net / sales) * 100)}%` : "",
  };
}

// ── 저장 경로(apply) ───────────────────────────────────────────────────────

/** 재무 입력 칸 — 이 칸을 고치면 비어 있던 기준 연도를 오늘 연도로 저장한다. */
export const FINANCE_INPUT_KEYS: readonly string[] = [...MONEY_KEYS, "결산연도", "기대출사업자"];

/** 반기 합계가 덮게 될 사용자 합계 글 → 기타메모 줄들. */
function replacedTotalLines(prev: Values, next: Values, baseYear: number): string[] {
  const lines: string[] = [];
  for (const i of ROWS) {
    const row = salesRowView(next, i);
    if (!row.auto) continue;
    const stored = text(prev, row.yearKey);
    // 이번 편집이 합계 칸을 직접 바꿨으면(문서 자동입력에서 체크) 명시적 덮어쓰기 — 옮기지 않는다.
    if (!stored || text(next, row.yearKey) !== stored) continue;
    const read = readMoney(stored);
    const storedTenths = tenthsOf(read);
    const hasMonth = read.kind === "legacy" && read.month !== null; // "6월" 표시는 덮으면 사라진다
    const before = salesRowView(prev, i);
    if (before.auto && storedTenths === before.total && !hasMonth) continue; // 자동 합계가 저장해 둔 값
    if (storedTenths !== null && storedTenths === row.total && !hasMonth) continue; // 같은 금액 — 모양만 바뀜
    lines.push(`매출 ${salesYearTag(i, baseYear)} 이전 합계: ${stored}`);
  }
  return lines;
}

/** 비율 3칸 — 계산값이 있으면 그 값. 없으면 자동으로 저장했던 값만 비우고 옛 글은 둔다. */
function ratioValues(prev: Values, next: Values, prevYear: number, nextYear: number): Record<string, string> {
  const now = computeRatios(next, nextYear);
  const before = computeRatios(prev, prevYear);
  const out: Record<string, string> = {};
  for (const k of RATIO_KEYS) {
    const stored = text(next, k);
    if (now[k] !== "") out[k] = now[k];
    else if (stored !== "" && stored === before[k]) out[k] = "";
  }
  return out;
}

/**
 * 편집 한 번(prev → next)을 저장할 값으로 — 합계·증가율·비율 계산, 덮인 합계 보존, 기준 연도·
 * 주민등록번호 앞자리 채움. 순수: 새 객체를 돌려준다.
 */
export function deriveCompanyInfo<T extends Values>(prev: T, next: T, today: Date): T {
  const out: Values = { ...next };
  const touched = FINANCE_INPUT_KEYS.some((k) => String(prev[k] ?? "") !== String(next[k] ?? ""));
  if (!text(out, SALES_BASE_YEAR_KEY) && touched) out[SALES_BASE_YEAR_KEY] = String(today.getFullYear());
  const baseYear = resolveBaseYear(out[SALES_BASE_YEAR_KEY], today);
  const lines = replacedTotalLines(prev, out, baseYear);
  if (lines.length > 0) {
    out.업체기타메모 = lines.reduce((m, l) => appendMemoLine(m, l), String(out.업체기타메모 ?? ""));
  }
  Object.assign(out, computeSalesTotals(out));
  Object.assign(out, computeSalesGrowth(out));
  Object.assign(out, ratioValues(prev, out, resolveBaseYear(prev[SALES_BASE_YEAR_KEY], today), baseYear));
  if (!text(out, "주민등록번호")) {
    const front = birthToRrnFront(out.대표자생년월일);
    if (front) out.주민등록번호 = front;
  }
  return out as T;
}

/** TXT 내보내기 — 저장할 때와 같은 계산값 + 화면이 쓰는 기준 연도(저장 전이어도). */
export function companyInfoForExport<T extends Values>(ci: T, today: Date): T {
  const out: Values = deriveCompanyInfo(ci, ci, today);
  if (!text(out, SALES_BASE_YEAR_KEY)) out[SALES_BASE_YEAR_KEY] = String(today.getFullYear());
  return out as T;
}

/**
 * 옛 자유 글 금액 한 칸을 백만원 숫자로 바꾸는 패치(「백만원으로 바꾸기」). 읽을 수 없으면 null.
 * "6월" 같은 몇 월 표시가 있던 글은 원문을 업체 기타메모에 "<라벨> 원래 적은 값: …" 로 남긴다.
 */
export function legacyMoneyConvertPatch(ci: Values, key: string, label: string): Record<string, string> | null {
  const raw = text(ci, key);
  const r = readMoney(raw, isSignedMoneyKey(key));
  if (r.kind !== "legacy" || r.tenths === null) return null;
  const patch: Record<string, string> = { [key]: formatTenths(r.tenths) };
  if (r.month !== null) patch.업체기타메모 = appendMemoLine(text(ci, "업체기타메모"), `${label} 원래 적은 값: ${raw}`);
  return patch;
}
