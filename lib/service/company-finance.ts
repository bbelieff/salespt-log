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
 *     #1068 문서 자동입력이 쓴 "25' 247백만"·"26' 6월 123백만" 처럼 반기 합의 반올림이거나 반기로 이미
 *     드러나는 몇 월 표시뿐인 합계는 같은 값으로 본다(옮기지 않음). 문서 자동입력이 반기 합과 다른
 *     합계를 고르면 그 값도 기타메모로 남긴다.
 *   · 반기를 다시 모두 비우면 자동으로 적었던 합계를 지운다 — 기타메모로 옮겨 둔 그 줄의 옛 합계가 있으면 되돌린다.
 *   · 기준 연도가 비었는데 재무 칸을 고치거나 재무 값이 있으면 오늘 연도를 함께 저장한다.
 *   · 주민등록번호가 비었고 생년월일을 읽을 수 있으면 앞자리를 함께 저장한다. 사용자가 주민등록번호를
 *     지우면 (화면에 없는) 생년월일도 함께 지운다 — 안 그러면 곧바로 다시 채워진다.
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
  /** 자동인데 합계 칸에 반기 합과 다른 값(금액이 다르거나 반기로 안 드러나는 "N월" 표시)이 있으면 그 글(이전 합계). */
  staleTotal: string;
};

/** #1068 문서 자동입력이 쓴 합계 모양 "25' 247백만" · "26' 6월 123백만" — 백만 단위로 반올림한 글. */
const WHOLE_BAEKMAN = /^\s*(?:(?:20)?\d{2}\s*['’‘`´년]\s*)?(?:\d{1,2}\s*월\s*)?[\d,]+\s*백만원?\s*$/;

/**
 * 저장된 합계 글이 반기 합과 같은 값인가. 금액이 같고(백만 단위 글은 반올림 ±0.5백만 안),
 * "N월" 표시는 반기 칸으로 이미 드러날 때(6월 = 상반기만, 12월 = 두 반기)만 같다고 본다.
 */
function sameAsHalves(stored: string, read: MoneyRead, halves: readonly MoneyRead[], sum: number | null): boolean {
  const t = tenthsOf(read);
  if (t === null || sum === null) return false;
  const tolerance = read.kind === "legacy" && WHOLE_BAEKMAN.test(stored) ? 5 : 0;
  if (Math.abs(t - sum) > tolerance) return false;
  if (read.kind !== "legacy" || read.month === null) return true;
  const first = halves[0]?.kind !== "empty";
  const second = halves[1]?.kind !== "empty";
  return (read.month === 6 && first && !second) || (read.month === 12 && first && second);
}

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
    staleTotal: auto && stored !== "" && !sameAsHalves(stored, yearly, halves, sum) ? stored : "",
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
export function partialYearNote(ci: Values, baseYear: number): string {
  const r = salesRowView(ci, 0);
  const tag = salesYearTag(0, baseYear);
  if (r.auto && r.only === "상반기") return `${tag}는 상반기 매출만 있어 낮게 보일 수 있어요`;
  const y = r.yearly;
  if (!r.auto && y.kind === "legacy" && y.month !== null && y.month < 12) {
    return `${tag}는 ${y.month}월까지 매출이라 낮게 보일 수 있어요`;
  }
  return "";
}

// ── 재무 비율 ──────────────────────────────────────────────────────────────

export const RATIO_KEYS = ["부채비율", "이자보상배율", "당기순이익률"] as const;
export type RatioKey = (typeof RATIO_KEYS)[number];

/** 소수 한 자리 — 반올림은 0 에서 먼 쪽(금액과 같은 규칙: 2.45 → 2.5, -2.45 → -2.5). "-0.0" 없음. */
const oneDecimal = (x: number) => {
  const r = Math.round(Math.abs(x) * 10 + 1e-9) / 10;
  return (x < 0 && r !== 0 ? -r : r).toFixed(1);
};

/** 비율 글 → 숫자("120%" · "120.0%" · "2.4배"). 자본잠식·못 읽는 글은 null. */
function ratioNumber(s: string): number | null {
  const m = s.replace(/,/g, "").match(/^\s*([-+−]?\d+(?:\.\d+)?)\s*(?:%|배)?\s*$/);
  return m ? Number(m[1]!.replace("−", "-")) : null;
}

/** 저장된 비율 글과 계산값이 같은 값인가 — 모양("120%" vs "120.0%")이 달라도 소수 한 자리 숫자가 같으면 같다. */
export function sameRatioText(stored: string, computed: string): boolean {
  const a = stored.trim();
  const b = computed.trim();
  if (a === b) return true;
  const x = ratioNumber(a);
  const y = ratioNumber(b);
  return x !== null && y !== null && Math.round(x * 10) === Math.round(y * 10);
}

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

const replacedLabel = (i: number, baseYear: number) => `매출 ${salesYearTag(i, baseYear)} 이전 합계: `;

/** 반기 합계가 덮게 될 합계 글 → 기타메모 줄들. */
function replacedTotalLines(prev: Values, next: Values, baseYear: number): string[] {
  const lines: string[] = [];
  for (const i of ROWS) {
    const row = salesRowView(next, i);
    if (!row.auto) continue;
    const stored = text(prev, row.yearKey);
    const now = text(next, row.yearKey);
    if (now !== stored) {
      // 이번 편집이 합계 칸을 직접 바꿨다(문서 자동입력에서 체크) — 옛 값은 고른 대로 바뀐다. 다만 반기 칸이
      // 있어 합계는 반기 합으로 저장되므로, 반기 합과 다른 고른 값은 버리지 않고 기타메모에 남긴다.
      if (now && !sameAsHalves(now, readMoney(now), row.halves, row.total)) {
        lines.push(`매출 ${salesYearTag(i, baseYear)} 합계(반기 합과 달라 옮김): ${now}`);
      }
      continue;
    }
    if (!stored) continue;
    const read = readMoney(stored);
    const before = salesRowView(prev, i);
    // 이전 반기 합과 같던 합계(자동 합계가 저장한 값 · 반기와 맞는 옛 합계) — 반기를 고치는 중이라 옮기지 않는다.
    if (before.auto && sameAsHalves(stored, read, before.halves, before.total)) continue;
    if (sameAsHalves(stored, read, row.halves, row.total)) continue; // 같은 값 — 모양만 바뀜
    lines.push(`${replacedLabel(i, baseYear)}${stored}`);
  }
  return lines;
}

/**
 * 이번 편집으로 반기가 모두 비었으면 자동으로 적었던 합계를 지운다(반기 합에서 나온 값이라 반기를 지우면
 * 뜻이 없다 — 치다 지운 "1" 같은 값이 남지 않게). 그 줄의 옛 합계를 기타메모로 옮겨 둔 줄이 있으면 되돌린다.
 */
function restoreClearedTotals(prev: Values, out: Values, baseYear: number): void {
  for (const i of ROWS) {
    const before = salesRowView(prev, i);
    if (!before.auto || before.total === null) continue;
    const row = salesRowView(out, i);
    if (row.halves.some((h) => h.kind !== "empty")) continue;
    const stored = text(prev, row.yearKey);
    if (text(out, row.yearKey) !== stored || stored !== formatTenths(before.total)) continue;
    const label = replacedLabel(i, baseYear);
    const memo = String(out.업체기타메모 ?? "").split("\n");
    const at = memo.map((l) => l.startsWith(label)).lastIndexOf(true);
    if (at >= 0) {
      out[row.yearKey] = memo[at]!.slice(label.length);
      memo.splice(at, 1);
      out.업체기타메모 = memo.join("\n");
    } else {
      out[row.yearKey] = "";
    }
  }
}

/** 비율 3칸 — 계산값이 있으면 그 값. 없으면 자동으로 저장했던 값만 비우고 옛 글은 둔다. */
function ratioValues(prev: Values, next: Values, prevYear: number, nextYear: number): Record<string, string> {
  const now = computeRatios(next, nextYear);
  const before = computeRatios(prev, prevYear);
  const out: Record<string, string> = {};
  for (const k of RATIO_KEYS) {
    const stored = text(next, k);
    if (now[k] !== "") out[k] = now[k];
    else if (stored !== "" && before[k] !== "" && sameRatioText(stored, before[k])) out[k] = "";
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
  // 재무 값이 있는 업체는 (다른 칸을 고쳐도) 이번 저장에 합계·증가율이 함께 저장되므로 기준 연도도 같이 —
  // 안 그러면 해가 바뀔 때 칸 이름(Y·Y-1…)이 값과 어긋난다.
  const hasFinance = FINANCE_INPUT_KEYS.some((k) => text(out, k) !== "");
  if (!text(out, SALES_BASE_YEAR_KEY) && (touched || hasFinance)) {
    out[SALES_BASE_YEAR_KEY] = String(today.getFullYear());
  }
  const baseYear = resolveBaseYear(out[SALES_BASE_YEAR_KEY], today);
  restoreClearedTotals(prev, out, baseYear);
  const lines = replacedTotalLines(prev, out, baseYear);
  if (lines.length > 0) {
    out.업체기타메모 = lines.reduce((m, l) => appendMemoLine(m, l), String(out.업체기타메모 ?? ""));
  }
  Object.assign(out, computeSalesTotals(out));
  Object.assign(out, computeSalesGrowth(out));
  Object.assign(out, ratioValues(prev, out, resolveBaseYear(prev[SALES_BASE_YEAR_KEY], today), baseYear));
  if (!text(out, "주민등록번호")) {
    const front = birthToRrnFront(out.대표자생년월일);
    // 이번 편집이 주민등록번호를 비웠다 — 생년월일(화면에 없는 같은 뜻의 값)도 지워야 비운 채로 남는다.
    if (front && text(prev, "주민등록번호")) out.대표자생년월일 = "";
    else if (front) out.주민등록번호 = front;
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
