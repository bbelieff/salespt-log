/**
 * document-ocr/parse-vat — 부가가치세 과세표준증명 OCR 텍스트 → 업체정보 매출 칸 제안.
 *
 * 채우는 칸: 반기 매출 8칸(매출Y상·매출Y하 … 매출Y3상·매출Y3하 — 값만 "1.2억", 공용 formatManwon) ·
 *   금년도매출("26' 6월 100백만" — 월 = 신고로 덮인 마지막 달) · 과년도매출("25' 250백만") ·
 *   과년도매출Y2 · 과년도매출Y3 · 면세수입금액("25년 3,200만").
 * 올해/작년 판단은 today(주입 가능) 기준이다. 반기 칸은 올해~3년 전(Y~Y-3)만 — 그보다 오래된 반기와
 * 간이과세 연간 신고(반기 구분 없음)는 연도 합계에만 들어간다. 옛 한 칸 반기별매출은 더 채우지 않는다
 * (company-info-restructure 2026-09-28).
 *
 * 한 과세기간 줄 = 연도+기수("2025년 1기") 또는 기간("2025.01.01~2025.06.30") + 신고구분 + 금액.
 * 금액은 날짜·기간·사업자번호를 지운 뒤 **첫 번째 금액**(과세표준 열)이다.
 *
 * 겹침 규칙(이중 합산 금지):
 * - 같은 기간이 여러 번 → 수정 > 확정(정기·기한후) > 예정 중 하나만.
 * - 한 기간이 다른 기간을 품으면(확정 1~6월 ⊃ 예정 1~3월) 큰 쪽(확정)만.
 * - 기간이 서로 안 겹치면(법인: 예정 1~3월 + 확정 4~6월) 더한다.
 *
 * 개인정보: 13자리 등록번호 꼴은 읽기 전에 원문에서 지운다. 원문은 결과·경고에 싣지 않는다.
 */
import { formatBaekman, formatManwon } from "./amount";
import { THIRTEEN_DIGIT_ID, compactText, normalizeOcrText, toLines } from "./text-utils";
import type { CompanyInfoKey, DocParseResult, ParsedField } from "./types";
import { SALES_HALF_KEYS } from "@/util/company-sales";

export type VatParseOptions = { today?: Date };

// ── 금액 토큰 ─────────────────────────────────────────────────────────────
/** "125,000,000" / "125.000.000" / "125000000" → 125000000 (아니면 null). */
export function parseAmountToken(raw: string): number | null {
  const t = raw.replace(/\s+/g, "");
  if (/^\d{1,3}(?:[,.]\d{3})+$/.test(t) || /^\d+$/.test(t)) return Number(t.replace(/[,.]/g, ""));
  return null;
}

// ── 줄 정리 ────────────────────────────────────────────────────────────────
const NUMBERISH = /[0-9OoIl|]{1,3}(?:[,，.][0-9OoIl|]{3})+/g;
/** 숫자 묶음 안의 OCR 오독(O→0, l/I/|→1, 전각 쉼표)만 고친다. */
function fixNumericNoise(line: string): string {
  return line.replace(NUMBERISH, (tok) =>
    (tok.match(/\d/g)?.length ?? 0) >= 2 ? tok.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/，/g, ",") : tok,
  );
}

const D = String.raw`(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?`;
const RANGE = new RegExp(`${D}\\s*[~∼〜-]\\s*${D}`);
const RANGE_G = new RegExp(RANGE.source, "g");
const HALF = /(20\d{2})\s*년?\s*(?:제\s*)?([12])\s*기/;
const HALF_G = new RegExp(HALF.source, "g");
const SINGLE_DATE = /(?:19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?|(?<!\d)20\d{6}(?!\d)/g;
const BIZNO_LIKE = /\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/g;
/** 금액 토큰. 그룹1 = 음수 표시("-" 바로 붙음 · "△"/"▲"). 앞이 숫자·"-"인 대시 번호 꼬리는 잡지 않는다. */
const AMOUNT = /(?<![\d,.\-])(-(?=\d)|[△▲]\s*)?(\d{1,3}(?:[,.]\d{3})+|\d{6,})(?!\d|[,.]\d)/g;
const ZERO = /(?<![\d,.\-])0(?![\d,.])/;
const TAX_FREE = /면\s*세\s*(?:수\s*입\s*)?금\s*액|면\s*세\s*수\s*입/;
/** 과세기간 줄이 아닌 기간(증명·조회·발급 기간). */
const NOT_ROW = /증\s*명\s*기\s*간|조\s*회\s*기\s*간|발\s*급|신\s*청\s*일|유\s*효/;

function stripNonAmounts(s: string): string {
  return s.replace(RANGE_G, " ").replace(HALF_G, " ").replace(SINGLE_DATE, " ").replace(BIZNO_LIKE, " ");
}

/**
 * 첫 금액. 음수(수정·환급 줄의 "-5,000,000" · "△5,000,000")면 음수로 돌려준다 —
 * 호출부가 그 줄을 빼고 경고한다(다음 칸 납부세액을 매출로 잘못 읽지 않게).
 */
function firstAmount(s: string, allowZero: boolean): number | null {
  const body = stripNonAmounts(s);
  for (const m of body.matchAll(AMOUNT)) {
    const v = parseAmountToken(m[2]!);
    if (v !== null) return m[1] ? -v : v;
  }
  return allowZero && ZERO.test(body) ? 0 : null;
}

// ── 과세기간 줄 ────────────────────────────────────────────────────────────
type Kind = "수정" | "확정" | "예정";
const PRIORITY: Record<Kind, number> = { 수정: 3, 확정: 2, 예정: 1 };

type Row = {
  year: number;
  /** 1=상반기 2=하반기 0=연간(간이과세 1~12월) */
  half: 0 | 1 | 2;
  start: number;
  end: number;
  kind: Kind;
  amount: number;
  pieced: boolean;
  kindGuessed: boolean;
};

function detectKind(s: string): { kind: Kind; guessed: boolean } {
  const c = s.replace(/\s+/g, "");
  if (c.includes("수정")) return { kind: "수정", guessed: false };
  if (/확정|정기|기한후/.test(c)) return { kind: "확정", guessed: false };
  if (c.includes("예정")) return { kind: "예정", guessed: false };
  return { kind: "확정", guessed: true };
}

type Period = Omit<Row, "amount" | "pieced">;

function readPeriod(line: string): Period | null {
  if (NOT_ROW.test(line)) return null;
  const r = line.match(RANGE);
  const h = line.match(HALF);
  const { kind, guessed } = detectKind(line);
  if (r) {
    const [y1, m1, y2, m2] = [Number(r[1]), Number(r[2]), Number(r[4]), Number(r[5])];
    if (y1 !== y2 || m1 < 1 || m2 > 12 || m1 > m2) return null;
    const half = m1 === 1 && m2 === 12 ? 0 : m1 <= 6 ? 1 : 2;
    if (half !== 0 && m2 > 6 && m1 <= 6) return null; // 반기를 가로지르는 기간 — 과세기간 아님
    return { year: y1, half, start: m1, end: m2, kind, kindGuessed: guessed && !h };
  }
  if (h) {
    const half = Number(h[2]) as 1 | 2;
    const base = half === 1 ? 1 : 7;
    const end = kind === "예정" ? base + 2 : base + 5;
    return { year: Number(h[1]), half, start: base, end, kind, kindGuessed: guessed };
  }
  return null;
}

function hasPeriod(line: string): boolean {
  return RANGE.test(line) || HALF.test(line);
}

// ── 겹침 정리 ──────────────────────────────────────────────────────────────
type Group = { year: number; half: 0 | 1 | 2; start: number; end: number; amount: number; confidence: number; warnings: string[] };

function rowConfidence(r: Row): number {
  if (r.pieced) return 0.6;
  return r.kindGuessed ? 0.75 : 0.85;
}

function resolveGroup(rows: Row[]): Group {
  const warnings: string[] = [];
  // 1) 같은 기간 → 우선순위 높은 한 줄
  const byRange = new Map<string, Row>();
  for (const r of rows) {
    const key = `${r.start}-${r.end}`;
    const prev = byRange.get(key);
    if (!prev) byRange.set(key, r);
    else {
      if (PRIORITY[r.kind] > PRIORITY[prev.kind]) byRange.set(key, r);
      else if (PRIORITY[r.kind] === PRIORITY[prev.kind] && r.amount !== prev.amount) {
        warnings.push("같은 기간 금액이 둘이에요. 앞의 것을 골랐어요.");
      }
    }
  }
  let kept = [...byRange.values()];
  // 2) 다른 기간을 품는 기간이 있으면 품긴 쪽을 버린다(확정 1~6월 ⊃ 예정 1~3월).
  kept = kept.filter((r) => !kept.some((o) => o !== r && o.start <= r.start && o.end >= r.end));
  // 3) 그래도 일부만 겹치면 우선순위·넓이 순으로 하나씩, 겹치지 않는 것만 더한다.
  kept.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || b.end - b.start - (a.end - a.start));
  const chosen: Row[] = [];
  for (const r of kept) {
    if (chosen.some((c) => r.start <= c.end && c.start <= r.end)) {
      warnings.push("신고 기간이 일부 겹쳐요. 한쪽만 합했어요.");
      continue;
    }
    chosen.push(r);
  }
  if (chosen.some((r) => r.pieced)) warnings.push("금액을 끊어진 줄에서 이어 읽었어요. 확인해 주세요.");
  const confidence = Math.min(...chosen.map(rowConfidence), warnings.length > 0 ? 0.6 : 1);
  return {
    year: chosen[0]!.year,
    half: chosen[0]!.half,
    start: Math.min(...chosen.map((r) => r.start)),
    end: Math.max(...chosen.map((r) => r.end)),
    amount: chosen.reduce((s, r) => s + r.amount, 0),
    confidence,
    warnings: [...new Set(warnings)],
  };
}

function halfLabel(g: Group): string {
  const name = g.half === 0 ? "연간" : g.half === 1 ? "상반기" : "하반기";
  const full = g.half === 0 ? g.start === 1 && g.end === 12 : g.end - g.start === 5;
  return full ? name : `${name}(${g.start}~${g.end}월)`;
}

const yy = (y: number) => String(y % 100).padStart(2, "0");

// ── 본체 ───────────────────────────────────────────────────────────────────
export function parseVatCertificate(rawText: string, opts: VatParseOptions = {}): DocParseResult {
  const today = opts.today ?? new Date();
  const thisYear = today.getFullYear();
  const normalized = normalizeOcrText(rawText);
  const fields: ParsedField[] = [];
  const documentWarnings: string[] = [];
  if (!normalized.trim()) {
    return { fields, documentWarnings: ["읽힌 글자가 없어요. 더 선명한 사진으로 다시 해 보세요."] };
  }
  if (/주\s*민\s*(?:\(\s*법\s*인\s*\)\s*)?등\s*록\s*번\s*호/.test(normalized)) {
    documentWarnings.push("주민등록번호는 읽지 않았어요.");
  }
  const unit = /단위\S{0,2}천원/.test(compactText(normalized)) ? 1000 : 1;
  const lines = toLines(normalized.replace(THIRTEEN_DIGIT_ID, " ")).map(fixNumericNoise);

  const rows: Row[] = [];
  const taxFree = new Map<number | null, { amount: number; pieced: boolean }>();
  let lastYear: number | null = null;
  let unread = 0;
  let negative = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    // 면세 수입금액 — 라벨 뒤만 면세, 라벨 앞은 과세 줄로 계속 읽는다.
    const tf = line.match(TAX_FREE);
    const taxPart = tf && tf.index !== undefined ? line.slice(0, tf.index) : line;
    if (tf && tf.index !== undefined) {
      const after = line.slice(tf.index + tf[0].length);
      let amt = firstAmount(after, true);
      let pieced = false;
      const next = lines[i + 1];
      if (amt === null && next && !hasPeriod(next)) {
        amt = firstAmount(next, false);
        pieced = amt !== null;
      }
      const yearHere = line.match(/(20\d{2})\s*년/);
      const year = yearHere ? Number(yearHere[1]) : (readPeriod(taxPart)?.year ?? lastYear);
      if (amt !== null && amt < 0) negative += 1;
      else if (amt !== null) {
        const prev = taxFree.get(year) ?? { amount: 0, pieced: false };
        taxFree.set(year, { amount: prev.amount + amt * unit, pieced: prev.pieced || pieced });
      }
    }

    const period = readPeriod(taxPart);
    if (!period) continue;
    lastYear = period.year;
    let amount = firstAmount(taxPart, true);
    let pieced = false;
    for (let j = i + 1; amount === null && j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const nx = lines[j]!;
      if (hasPeriod(nx) || TAX_FREE.test(nx)) break;
      amount = firstAmount(nx, false);
      pieced = amount !== null;
    }
    if (amount === null) {
      unread += 1;
      continue;
    }
    if (amount < 0) {
      negative += 1;
      continue;
    }
    rows.push({ ...period, amount: amount * unit, pieced });
  }

  if (unread > 0) documentWarnings.push(`과세기간 ${unread}줄은 금액을 못 읽었어요.`);
  if (negative > 0) documentWarnings.push(`금액이 마이너스(-)인 ${negative}줄은 합계에서 뺐어요. 확인해 주세요.`);

  // 연도·반기별 묶기
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.year > thisYear) continue;
    const key = `${r.year}-${r.half}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  if (rows.some((r) => r.year > thisYear)) documentWarnings.push("오늘보다 뒤 연도의 줄은 뺐어요.");
  const groups = [...byKey.values()]
    .map(resolveGroup)
    .sort((a, b) => b.year - a.year || b.end - a.end);

  // 반기 칸 — 올해(Y)~3년 전(Y-3)의 상·하반기. 반기를 다 못 채운 신고(예정 1~3월만)는 값은 그대로 두고
  // 몇 월 신고인지 경고한다(칸 이름이 "상반기"라 1~3월 금액을 반기 전체로 오해하지 않게).
  for (const g of groups) {
    if (g.half === 0) continue; // 간이과세 연간 — 반기 구분 없음(연도 합계 칸에만)
    const pair = SALES_HALF_KEYS[thisYear - g.year];
    if (!pair) continue; // 3년보다 오래된 반기
    const key: CompanyInfoKey = pair[g.half - 1]!;
    const full = g.end - g.start === 5;
    const warnings = [...g.warnings];
    if (!full) warnings.push(`${yy(g.year)}년 ${halfLabel(g)} 신고 금액이에요. 반기 전체가 아니에요.`);
    fields.push({
      key,
      value: formatManwon(g.amount),
      confidence: Math.min(0.85, g.confidence, full ? 1 : 0.6),
      warnings,
    });
  }

  // 연도 합계 → 금년도/과년도 칸
  const years = new Map<number, Group[]>();
  for (const g of groups) years.set(g.year, [...(years.get(g.year) ?? []), g]);
  const yearKeys = [
    [thisYear, "금년도매출"],
    [thisYear - 1, "과년도매출"],
    [thisYear - 2, "과년도매출Y2"],
    [thisYear - 3, "과년도매출Y3"],
  ] as const;
  for (const [year, key] of yearKeys) {
    const gs = years.get(year);
    if (!gs) continue;
    const annual = gs.find((g) => g.half === 0);
    const used = annual ? [annual] : gs;
    const warnings = [...new Set(used.flatMap((g) => g.warnings))];
    if (annual && gs.length > 1) warnings.push("연간 신고와 반기 신고가 같이 있어요. 연간 신고로 합했어요.");
    const months = new Set<number>();
    for (const g of used) for (let m = g.start; m <= g.end; m += 1) months.add(m);
    const lastMonth = Math.max(...used.map((g) => g.end));
    const sum = used.reduce((s, g) => s + g.amount, 0);
    let confidence = Math.min(...used.map((g) => g.confidence));
    const partial = months.size < 12;
    if (key !== "금년도매출" && partial) {
      warnings.push(`${yy(year)}년은 ${months.size}개월 신고만 있어요. 일부만 합했어요.`);
      confidence = Math.min(confidence, 0.5);
    }
    const value =
      key === "금년도매출"
        ? `${yy(year)}' ${lastMonth}월 ${formatBaekman(sum)}`
        : `${yy(year)}' ${formatBaekman(sum)}`;
    fields.push({ key, value, confidence: Math.min(confidence, 0.85), warnings });
  }

  // 면세 수입금액 — 가장 최근 연도 하나
  if (taxFree.size > 0) {
    const knownYears = [...taxFree.keys()].filter((y): y is number => y !== null).sort((a, b) => b - a);
    const year = knownYears[0] ?? null;
    const hit = taxFree.get(year)!;
    const warnings: string[] = [];
    if (year === null) warnings.push("면세 금액의 연도를 못 찾았어요. 확인해 주세요.");
    if (hit.pieced) warnings.push("금액을 끊어진 줄에서 이어 읽었어요. 확인해 주세요.");
    fields.push({
      key: "면세수입금액",
      value: `${year === null ? "" : `${yy(year)}년 `}${formatManwon(hit.amount)}`,
      confidence: year === null || hit.pieced ? 0.55 : 0.75,
      warnings,
    });
  }

  if (fields.length === 0) {
    documentWarnings.push("과세기간별 금액을 찾지 못했어요. 문서 종류가 맞는지 확인해 주세요.");
  }
  return { fields, documentWarnings };
}
