/**
 * Layer: util (순수 — import 0). 업체정보 [재무] 매출 칸 해석 (company-info-restructure 2026-09-28).
 *
 * - 연도 라벨: "Y(2026)" · "Y-1(2025)" … 오늘 날짜(주입 가능)로 달력 연도를 붙인다.
 * - 매출 금액 읽기: 학생이 적는 여러 모양을 원 단위로 — "250백만" · "1.2억" · "3,200만" ·
 *   "1억 2,500만" · "25' 250백만"(앞 연도 표시) · "26' 6월 100백만"(6월까지) · "250,000,000"(원).
 *   금액 덩어리가 둘 이상이거나 못 읽으면 null(추측하지 않는다).
 * - 매출증가율 3칸: Y-3→Y-2 · Y-2→Y-1 · Y-1→Y. "+12.5%" / "-3.0%" (소수 한 자리). 한쪽이라도
 *   못 읽거나 이전 해 매출이 0 이하면 "".
 *
 * 키 이름은 CompanyInfo(lib/types) 와 같다 — util 은 import 0 이라 문자열로 둔다.
 */

/** 연도 매출 칸 4개 — [Y, Y-1, Y-2, Y-3]. 키는 기존 저장 키 유지(과년도매출 = Y-1). */
export const SALES_YEAR_KEYS = ["금년도매출", "과년도매출", "과년도매출Y2", "과년도매출Y3"] as const;
export type SalesYearKey = (typeof SALES_YEAR_KEYS)[number];

/** 반기 매출 8칸 — 연도(Y..Y-3)마다 [상반기, 하반기]. */
export const SALES_HALF_KEYS = [
  ["매출Y상", "매출Y하"],
  ["매출Y1상", "매출Y1하"],
  ["매출Y2상", "매출Y2하"],
  ["매출Y3상", "매출Y3하"],
] as const;
export type SalesHalfKey = (typeof SALES_HALF_KEYS)[number][number];

/** 매출증가율 3칸 — from(이전 해) → to(다음 해). yearsAgo = 두 해 중 이전 해가 몇 년 전인지. */
export const SALES_GROWTH_DEFS = [
  { key: "매출증가율Y3Y2", from: "과년도매출Y3", to: "과년도매출Y2", fromAgo: 3 },
  { key: "매출증가율Y2Y1", from: "과년도매출Y2", to: "과년도매출", fromAgo: 2 },
  { key: "매출증가율Y1Y", from: "과년도매출", to: "금년도매출", fromAgo: 1 },
] as const;
export type SalesGrowthKey = (typeof SALES_GROWTH_DEFS)[number]["key"];

/** "Y" / "Y-1" … (몇 년 전인지). */
export function salesYearToken(yearsAgo: number): string {
  return yearsAgo === 0 ? "Y" : `Y-${yearsAgo}`;
}

/** "Y(2026)" / "Y-1(2025)" — 오늘 기준 달력 연도를 괄호로. */
export function salesYearTag(yearsAgo: number, today: Date): string {
  return `${salesYearToken(yearsAgo)}(${today.getFullYear() - yearsAgo})`;
}

/** 증가율 칸 이름 "Y-3→Y-2" (연도 없이 — 칸이 좁다). */
export function salesGrowthName(fromAgo: number): string {
  return `${salesYearToken(fromAgo)}→${salesYearToken(fromAgo - 1)}`;
}

export type SalesAmount = { won: number; month: number | null };

const UNIT: Record<string, number> = {
  억: 1e8,
  천만: 1e7,
  백만: 1e6,
  십만: 1e5,
  만: 1e4,
  천: 1e3,
};
const TOKEN = /(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|십만|만|천)?/g;
/** 맨 앞 연도 표시 "25'" · "25’" · "2025년" · "25년". */
const YEAR_TAG = /^\s*(?:20)?\d{2}\s*(?:['’‘`´]|년)\s*/;
/** "1~6월" — 끝 달. */
const MONTH_RANGE = /\d{1,2}\s*[~∼〜-]\s*(\d{1,2})\s*월/;
/** "6월" · "6개월". */
const MONTH = /(\d{1,2})\s*개?\s*월/;

/**
 * 매출 칸 글 → 원 단위 금액(+ 몇 월까지인지). 못 읽거나 금액 덩어리가 둘 이상이면 null.
 * 단위 없는 숫자는 원("250,000,000"). 음수 표시는 지원하지 않는다(매출 칸).
 */
export function parseSalesAmount(raw: string): SalesAmount | null {
  let s = String(raw ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .trim();
  if (!s) return null;
  s = s.replace(YEAR_TAG, " ");
  let month: number | null = null;
  const range = s.match(MONTH_RANGE);
  const single = range ? null : s.match(MONTH);
  const hit = range ?? single;
  if (hit && hit.index !== undefined) {
    const m = Number(hit[1]);
    if (m >= 1 && m <= 12) month = m;
    s = `${s.slice(0, hit.index)} ${s.slice(hit.index + hit[0].length)}`;
  }
  type Tok = { value: number; unit: number | null; start: number; end: number };
  const toks: Tok[] = [];
  for (const m of s.matchAll(TOKEN)) {
    const value = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(value)) return null;
    const start = m.index ?? 0;
    toks.push({ value, unit: m[2] ? UNIT[m[2]]! : null, start, end: start + m[0].length });
  }
  if (toks.length === 0) return null;
  // 한 덩어리 = 큰 단위 → 작은 단위로 공백만 끼고 이어지는 토큰들("1억 2,500만", "2억5천만").
  let chains = 1;
  for (let i = 1; i < toks.length; i++) {
    const prev = toks[i - 1]!;
    const cur = toks[i]!;
    const joined =
      s.slice(prev.end, cur.start).trim() === "" &&
      prev.unit !== null &&
      cur.unit !== null &&
      cur.unit < prev.unit;
    if (!joined) chains += 1;
  }
  if (chains !== 1) return null;
  const won = Math.round(toks.reduce((sum, t) => sum + t.value * (t.unit ?? 1), 0));
  return { won, month };
}

/** 이전 해 → 다음 해 증가율 "+12.5%" / "-3.0%" / "0.0%". 이전 해가 0 이하면 "". */
export function formatGrowthRate(fromWon: number, toWon: number): string {
  if (!(fromWon > 0) || !Number.isFinite(toWon)) return "";
  const r = Math.round(((toWon - fromWon) / fromWon) * 1000) / 10;
  if (r === 0) return "0.0%";
  return `${r > 0 ? "+" : "-"}${Math.abs(r).toFixed(1)}%`;
}

type Values = Partial<Record<string, unknown>>;
const text = (ci: Values, k: string) => String(ci[k] ?? "");

/** 연도 매출 칸들 → 매출증가율 3칸 값. */
export function computeSalesGrowth(ci: Values): Record<SalesGrowthKey, string> {
  const out = {} as Record<SalesGrowthKey, string>;
  for (const d of SALES_GROWTH_DEFS) {
    const a = parseSalesAmount(text(ci, d.from));
    const b = parseSalesAmount(text(ci, d.to));
    out[d.key] = a && b ? formatGrowthRate(a.won, b.won) : "";
  }
  return out;
}

/** 매출증가율 3칸을 연도 매출에 맞게 다시 채운 사본. 바뀐 게 없으면 같은 객체를 돌려준다. */
export function withSalesGrowth<T extends Values>(ci: T): T {
  const g = computeSalesGrowth(ci);
  const same = SALES_GROWTH_DEFS.every((d) => text(ci, d.key) === g[d.key]);
  return same ? ci : { ...ci, ...g };
}

/** 올해(Y) 매출이 몇 월까지만인 부분 연도면 안내 문구, 아니면 "". */
export function partialYearNote(currentYearSales: string): string {
  const a = parseSalesAmount(currentYearSales);
  if (!a || a.month === null || a.month >= 12) return "";
  return `올해는 ${a.month}월까지 매출이라 낮게 보일 수 있어요`;
}
