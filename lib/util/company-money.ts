/**
 * Layer: util (순수 — import 0). 업체정보 [재무] 금액 = 백만원 단위 (belie 결정 2026-09-28).
 *
 * - 저장 모양(정본): 백만원 숫자, 소수 한 자리까지 — "250.1" · "1,234" · "-3.2". 끝 ".0" 은 떼고
 *   "-0" 은 없다(0 은 "0"). 음수는 손익 칸(영업이익·당기순이익·자본총계)만.
 * - 계산(합계·증가율·비율)은 "십만원 정수"(= 백만원 × 10, tenths)로 한다 — 소수 더하기 오차가 없다.
 * - 문서 금액(원) → 백만원: wonToMillion. 소수 둘째 자리에서 반올림(.05 는 올림, 음수는 0 에서 먼 쪽).
 *   250,123,456원 → "250.1" · 12,345,678원 → "12.3" · 40,000원 → "0". 천원 문서는 호출부가 ×1,000 먼저.
 * - 옛 자유 글("25' 250백만" · "3,200만" · "1.2억")은 저장값을 바꾸지 않고 읽기만 한다(readMoney).
 *   단위 없는 숫자는 칸 단위(백만원)로 읽는다 — "25' 250" = 250백만원.
 * - parseSalesAmount: 매출 글 → 원(+ 몇 월까지). company-info-restructure 에서 옮겨 왔다.
 */

/** [재무] 금액 칸 19개 — 모두 백만원. */
export const MONEY_KEYS = [
  "매출Y상", "매출Y하", "매출Y1상", "매출Y1하", "매출Y2상", "매출Y2하", "매출Y3상", "매출Y3하",
  "금년도매출", "과년도매출", "과년도매출Y2", "과년도매출Y3",
  "영업이익", "당기순이익", "이자비용", "자산총계", "부채총계", "자본총계", "면세수입금액",
] as const;
export type MoneyKey = (typeof MONEY_KEYS)[number];

/** 마이너스를 쓸 수 있는 손익 칸. */
export const SIGNED_MONEY_KEYS: readonly string[] = ["영업이익", "당기순이익", "자본총계"];

export function isMoneyKey(k: string): k is MoneyKey {
  return (MONEY_KEYS as readonly string[]).includes(k);
}

export function isSignedMoneyKey(k: string): boolean {
  return SIGNED_MONEY_KEYS.includes(k);
}

// ── 매출 글 → 원 ──────────────────────────────────────────────────────────

export type SalesAmount = { won: number; month: number | null };

const UNIT: Record<string, number> = {
  억: 1e8,
  천만: 1e7,
  백만: 1e6,
  십만: 1e5,
  만: 1e4,
  천: 1e3,
  원: 1,
};
const TOKEN = /(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|십만|만|천|원)?/g;
/** 맨 앞 연도 표시 "25'" · "25’" · "2025년" · "25년". */
const YEAR_TAG = /^\s*(?:20)?\d{2}\s*(?:['’‘`´]|년)\s*/;
/** "1~6월" — 끝 달. */
const MONTH_RANGE = /\d{1,2}\s*[~∼〜-]\s*(\d{1,2})\s*월/;
/** "6월" · "6개월". */
const MONTH = /(\d{1,2})\s*개?\s*월/;

export type SalesAmountOptions = {
  /** 단위 없는 숫자 하나를 이 배수로 읽는다(백만원 칸 = 1e6). 없으면 원 — 쉼표 없는 1만 미만은 못 읽음. */
  bareUnit?: number;
};

/**
 * 매출 칸 글 → 원 단위 금액(+ 몇 월까지인지). 못 읽거나 금액 덩어리가 둘 이상이면 null.
 * 단위 없는 숫자는 원("250,000,000") — 단, 쉼표 없는 1만 미만("250"·"1.5")은 단위를 빠뜨린 글로 보고 null.
 * bareUnit 을 주면 단위 없는 숫자를 그 단위로 읽는다. 음수("-50백만")는 null(매출 칸).
 */
export function parseSalesAmount(raw: string, opts: SalesAmountOptions = {}): SalesAmount | null {
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
  type Tok = { value: number; unit: number | null; comma: boolean; start: number; end: number };
  const toks: Tok[] = [];
  for (const m of s.matchAll(TOKEN)) {
    const value = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(value)) return null;
    const start = m.index ?? 0;
    toks.push({ value, unit: m[2] ? UNIT[m[2]]! : null, comma: m[1]!.includes(","), start, end: start + m[0].length });
  }
  if (toks.length === 0) return null;
  // 숫자에 붙은 음수 표시("-50백만" · "△50백만")는 매출로 읽지 않는다 — 부호를 떼면 틀린 값이 된다.
  // 띄어 쓴 "2025년 - 250백만" 의 "-" 는 구분 기호라 그대로 읽는다.
  if (/[-−–△]$/.test(s.slice(0, toks[0]!.start))) return null;
  // "천" 홀로: 억 바로 뒤면 한국어 관례상 천만("2억5천" = 2억 5천만, "1억 2천 5백만" = 1억 2,500만).
  // 맨 앞 "3천" 은 3천만인지 3천 원인지 갈리므로 읽지 않는다.
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.unit !== UNIT.천) continue;
    const prev = toks[i - 1];
    if (!prev) return null;
    if (prev.unit === UNIT.억 && s.slice(prev.end, t.start).trim() === "") t.unit = UNIT.천만!;
  }
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
  const only = toks.length === 1 ? toks[0]! : null;
  if (only && only.unit === null && opts.bareUnit) {
    return { won: Math.round(only.value * opts.bareUnit), month };
  }
  // 단위 없는 숫자는 원 — 쉼표 없는 1만 미만("25' 250")은 단위를 빠뜨린 글이라 읽지 않는다("0" 은 0원).
  if (only && only.unit === null && !only.comma && only.value > 0 && only.value < 1e4) return null;
  const won = Math.round(toks.reduce((sum, t) => sum + t.value * (t.unit ?? 1), 0));
  return { won, month };
}

// ── 원 ↔ 백만원(십만원 정수) ─────────────────────────────────────────────

const TENTH_WON = 100_000; // 백만원의 1/10 = 10만원

const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 원 → 십만원 정수. 반올림(나머지 5만원 이상 올림), 음수는 0 에서 먼 쪽. 0 은 늘 +0. */
export function wonToTenths(won: number): number {
  if (!Number.isFinite(won)) return 0;
  const abs = Math.round(Math.abs(won));
  let q = Math.floor(abs / TENTH_WON);
  if ((abs - q * TENTH_WON) * 2 >= TENTH_WON) q += 1;
  return won < 0 && q !== 0 ? -q : q;
}

/** 십만원 정수 → 정본 글 "250.1" · "1,234" · "-3.2" · "0". */
export function formatTenths(tenths: number): string {
  const n = Math.trunc(tenths);
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const dec = abs % 10;
  return `${n < 0 ? "-" : ""}${groupDigits(Math.floor(abs / 10))}${dec ? `.${dec}` : ""}`;
}

/** 문서 금액(원) → 백만원 정본 글. 250,123,456 → "250.1". */
export function wonToMillion(won: number): string {
  return formatTenths(wonToTenths(won));
}

// ── 칸 값 읽기 ─────────────────────────────────────────────────────────────

/** 저장값 해석: 빈칸 · 백만원 숫자 · 옛 자유 글(읽은 값 또는 null). */
export type MoneyRead =
  | { kind: "empty" }
  | { kind: "number"; tenths: number }
  | { kind: "legacy"; tenths: number | null; month: number | null };

const NUMERIC = /^([-−]?)(\d[\d,]*)?(?:\.(\d*))?$/;
const LEGACY_NONE: MoneyRead = { kind: "legacy", tenths: null, month: null };

/** 숫자만 적힌 글(쉼표·소수점·앞 마이너스) → 십만원. 소수 둘째 자리는 반올림. 숫자 글이 아니면 null. */
function readNumeric(s: string): { tenths: number; negative: boolean } | null {
  const m = s.match(NUMERIC);
  if (!m || (!m[2] && !m[3])) return null;
  const int = Number((m[2] ?? "").replace(/,/g, "") || "0");
  const dec = m[3] ?? "";
  let tenths = int * 10 + Number(dec[0] ?? 0);
  if (dec.length > 1 && Number(dec[1]) >= 5) tenths += 1;
  const negative = Boolean(m[1]) && tenths !== 0;
  return { tenths: negative ? -tenths : tenths, negative };
}

/**
 * 금액 칸 저장값 읽기. 숫자 글("250.1" · "1234" · "-3")은 백만원 숫자, 그 밖은 옛 자유 글 —
 * 단위를 읽어 백만원으로 바꾼 값(못 읽으면 null)과 "몇 월까지" 표시를 돌려준다.
 * signed=false(매출·자산 등) 칸의 음수는 계산할 수 없는 글(tenths null)로 본다.
 */
export function readMoney(raw: unknown, signed = false): MoneyRead {
  const s = String(raw ?? "").trim();
  if (!s) return { kind: "empty" };
  const n = readNumeric(s);
  if (n) return n.negative && !signed ? LEGACY_NONE : { kind: "number", tenths: n.tenths };
  const neg = s.match(/^[-−–△▲]\s*/);
  if (neg && !signed) return LEGACY_NONE;
  const a = parseSalesAmount(neg ? s.slice(neg[0].length) : s, { bareUnit: 1e6 });
  if (!a) return LEGACY_NONE;
  const t = wonToTenths(a.won);
  return { kind: "legacy", tenths: neg && t !== 0 ? -t : t, month: a.month };
}

/** 계산에 쓸 값(십만원) — 비었거나 못 읽으면 null. */
export function moneyTenths(raw: unknown, signed = false): number | null {
  const r = readMoney(raw, signed);
  return r.kind === "empty" ? null : r.tenths;
}

// ── 입력칸 ─────────────────────────────────────────────────────────────────

/**
 * 입력 중 정리 — 숫자·쉼표·점(손익 칸은 맨 앞 "-")만 친 글이면 소수 한 자리까지만 남긴다(cut=true 면 잘랐음).
 * 글자가 섞인 글(옛 자유 글을 고치는 중)은 그대로 둔다 — 칸 아래 "글로 적힌 값" 안내가 붙는다.
 */
export function sanitizeMoneyTyping(raw: string, signed: boolean): { value: string; cut: boolean } {
  if (!/^[\s\d,.\-−]*$/.test(raw)) return { value: raw, cut: false };
  let s = raw.replace(/\s+/g, "").replace(/−/g, "-");
  const neg = signed && s.startsWith("-");
  s = s.replace(/-/g, "");
  let cut = false;
  const dot = s.indexOf(".");
  if (dot >= 0) {
    const dec = s.slice(dot + 1).replace(/\./g, "");
    cut = dec.length > 1;
    s = `${s.slice(0, dot)}.${dec.slice(0, 1)}`;
  }
  return { value: `${neg ? "-" : ""}${s}`, cut };
}

/** 칸을 떠날 때 — 숫자 글은 정본("1,234" · "250.1")으로, "-"·"." 만 남았으면 비운다. 옛 자유 글은 그대로. */
export function formatMoneyOnBlur(raw: string, signed: boolean): string {
  if (/^[\s\-−.,]+$/.test(raw)) return "";
  const r = readMoney(raw, signed);
  return r.kind === "number" ? formatTenths(r.tenths) : raw;
}

/** 읽기 쉬운 금액 — 1억 이상 "약 2.5억", 그 아래 "약 3,200만". 0·없음은 "". */
export function moneyHint(tenths: number | null): string {
  if (tenths === null || tenths === 0) return "";
  const sign = tenths < 0 ? "-" : "";
  const abs = Math.abs(tenths);
  if (abs >= 1000) {
    const e10 = Math.round(abs / 100); // 억 × 10
    const dec = e10 % 10;
    return `약 ${sign}${groupDigits(Math.floor(e10 / 10))}${dec ? `.${dec}` : ""}억`;
  }
  return `약 ${sign}${groupDigits(abs * 10)}만`;
}

/** 표·비교표용 — 숫자면 "250.1백만원", 옛 자유 글은 그대로. */
export function moneyWithUnit(raw: unknown, signed = false): string {
  const s = String(raw ?? "").trim();
  const r = readMoney(s, signed);
  return r.kind === "number" ? `${formatTenths(r.tenths)}백만원` : s;
}

/** TXT 한 칸 — 숫자면 "250.1백만원 (약 2.5억)", 옛 자유 글은 그대로. */
export function formatMoneyTxt(raw: unknown, signed = false): string {
  const s = String(raw ?? "").trim();
  const r = readMoney(s, signed);
  if (r.kind !== "number") return s;
  const hint = moneyHint(r.tenths);
  return `${formatTenths(r.tenths)}백만원${hint ? ` (${hint})` : ""}`;
}
