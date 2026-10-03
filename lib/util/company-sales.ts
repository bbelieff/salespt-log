/**
 * Layer: util (순수 — import 0). 업체정보 [재무] 매출 칸의 키·연도 라벨·기준 연도
 * (company-info-restructure → company-finance-won-grid, belie 2026-09-28).
 *
 * - 연도 라벨: "Y(2026)" · "Y-1(2025)" … 괄호 연도는 업체마다 저장한 **매출 기준 연도**(매출기준연도)
 *   기준. 비었으면 오늘 연도(주입 가능). 기준 연도를 바꾸면 칸 이름만 바뀌고 값은 그대로다.
 * - 문서 연도 → 칸: slot = 기준 연도 − 문서 연도 (0=Y … 3=Y-3). 그 밖은 칸이 없다.
 * - 매출증가율 표기 "+12.5%" / "-3.0%" (소수 한 자리). 계산(합계·증가율)은 lib/service/company-finance.ts.
 * - 금액 읽기·백만원 표기는 lib/util/company-money.ts.
 *
 * 키 이름은 CompanyInfo(lib/types) 와 같다 — util 은 import 0 이라 문자열로 둔다.
 */

/** 연도 합계 칸 4개 — [Y, Y-1, Y-2, Y-3]. 키는 기존 저장 키 유지(과년도매출 = Y-1). */
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

/** 매출증가율 3칸 — from(이전 해) → to(다음 해). fromAgo = 두 해 중 이전 해가 Y 에서 몇 해 앞인지. */
export const SALES_GROWTH_DEFS = [
  { key: "매출증가율Y3Y2", from: "과년도매출Y3", to: "과년도매출Y2", fromAgo: 3 },
  { key: "매출증가율Y2Y1", from: "과년도매출Y2", to: "과년도매출", fromAgo: 2 },
  { key: "매출증가율Y1Y", from: "과년도매출", to: "금년도매출", fromAgo: 1 },
] as const;
export type SalesGrowthKey = (typeof SALES_GROWTH_DEFS)[number]["key"];

/** 매출 기준 연도 저장 키 — Y 칸이 몇 년인지("2026"). */
export const SALES_BASE_YEAR_KEY = "매출기준연도";
export const BASE_YEAR_MIN = 2000;
export const BASE_YEAR_MAX = 2100;

/** "Y" / "Y-1" … (기준 연도에서 몇 해 앞인지). */
export function salesYearToken(yearsAgo: number): string {
  return yearsAgo === 0 ? "Y" : `Y-${yearsAgo}`;
}

/** "Y(2026)" / "Y-1(2025)" — 기준 연도에서 센 달력 연도를 괄호로. */
export function salesYearTag(yearsAgo: number, baseYear: number): string {
  return `${salesYearToken(yearsAgo)}(${baseYear - yearsAgo})`;
}

/** 증가율 칸 이름 "Y-3→Y-2" (연도 없이 — 칸이 좁다). */
export function salesGrowthName(fromAgo: number): string {
  return `${salesYearToken(fromAgo)}→${salesYearToken(fromAgo - 1)}`;
}

/** 저장된 기준 연도 글 → 연도(네 자리·2000~2100). 비었거나 틀리면 null. */
export function parseBaseYear(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}$/.test(s)) return null;
  const y = Number(s);
  return y >= BASE_YEAR_MIN && y <= BASE_YEAR_MAX ? y : null;
}

/** 화면·계산에 쓰는 기준 연도 — 저장값, 없으면 오늘 연도. */
export function resolveBaseYear(raw: unknown, today: Date): number {
  return parseBaseYear(raw) ?? today.getFullYear();
}

/** 기준 연도 입력 검사 — 맞으면 "", 아니면 칸 아래 안내 문구. */
export function baseYearInputError(text: string): string {
  return parseBaseYear(text) === null ? `${BASE_YEAR_MIN}~${BASE_YEAR_MAX} 사이 네 자리 연도로 적어요` : "";
}

/** 문서 연도 → 매출 칸 번호(0=Y … 3=Y-3). 칸 밖이면 null. */
export function salesSlotOf(docYear: number, baseYear: number): number | null {
  const slot = baseYear - docYear;
  return Number.isInteger(slot) && slot >= 0 && slot <= 3 ? slot : null;
}

/** 이전 해 → 다음 해 증가율 "+12.5%" / "-3.0%" / "0.0%". 이전 해가 0 이하면 "". 단위는 아무거나(같기만). */
export function formatGrowthRate(before: number, after: number): string {
  if (!(before > 0) || !Number.isFinite(after)) return "";
  const r = Math.round(((after - before) / before) * 1000) / 10;
  if (r === 0) return "0.0%";
  return `${r > 0 ? "+" : "-"}${Math.abs(r).toFixed(1)}%`;
}
