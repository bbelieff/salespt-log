/**
 * document-ocr/bizplan-map — 서류 자동입력 파서 결과 → 사업계획서 작성도구 팩트시트 칸 제안
 * (docs/plans/active/bizplan-tool.md 다음 PR 1 「숫자 자동 읽기」, 2026-11-24).
 *
 * 파서(사업자등록증·재무제표·부가세)는 업체정보 칸 이름으로 결과를 낸다. 여기서 팩트시트 칸으로 옮긴다.
 * - 매출 연도 칸(금년도매출·과년도매출…) = 파싱할 때 준 기준 연도(baseYear)에서 몇 해 앞인지 → 실제 연도.
 * - 재무제표의 영업이익·당기순이익·자산/부채/자본총계는 그 문서의 결산연도 값이다.
 * - 부가세 연도 합계는 팩트시트 「과세표준」 칸으로 간다(반기 칸은 쓰지 않는다).
 *
 * 원칙(업체정보 자동입력과 같다): 제안만 만든다. 사용자가 고른 칸만 채우고, 이미 적힌 값은 기본으로 고르지 않는다.
 * 원문 글자는 싣지 않는다(개인정보).
 */
import { SALES_YEAR_KEYS } from "@/util/company-sales";
import type { BizplanDraft, BizplanYear } from "@/util/bizplan-pack";
import type { DocParseResult, DocType } from "./types";

export type BizplanInfoKey = "company" | "ceo" | "bizNo" | "industry" | "founded" | "address";
export type BizplanYearCol = Exclude<keyof BizplanYear, "year">;

export type BizplanTarget =
  | { kind: "info"; key: BizplanInfoKey }
  | { kind: "year"; year: string; col: BizplanYearCol };

/** 파서 결과 하나에서 나온 제안(아직 팩트시트와 맞춰 보기 전). */
export type BizplanRawSuggestion = {
  target: BizplanTarget;
  value: string;
  confidence: number;
  warnings: string[];
  valid?: boolean;
  /** 어느 파일에서 읽었는지(파일 이름) — 화면 표시용. */
  source: string;
};

/** 화면에 보여 줄 제안 한 줄. */
export type BizplanSuggestion = BizplanRawSuggestion & {
  id: string;
  label: string;
  /** 팩트시트에 지금 적힌 값("" = 빈칸). */
  current: string;
  /** 기본 체크 — 빈칸 + 믿을 만함 + 형식 통과일 때만. */
  check: boolean;
};

const INFO_LABEL: Record<BizplanInfoKey, string> = {
  company: "업체명", ceo: "대표자", bizNo: "사업자등록번호", industry: "업태·종목", founded: "설립일", address: "소재지",
};
const INFO_ORDER: BizplanInfoKey[] = ["company", "ceo", "bizNo", "industry", "founded", "address"];
const YEAR_COL_ORDER: BizplanYearCol[] = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "과세표준"];

export const MIN_CHECK_CONFIDENCE = 0.5;

const num = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * 두 인식기를 합칠 때 붙는 「다른 인식 결과: X」 중, 금액 자릿수가 10배 넘게 차이 나는 것(예: 1,500 ↔ 0)은
 * 한쪽이 표를 못 읽은 것이라 사람이 볼 필요가 없다 — 뺀다. 비슷한 숫자끼리 다를 때만 남긴다.
 */
export function cleanWarnings(value: string, warnings: string[]): string[] {
  const v = num(value);
  return warnings.filter((w) => {
    const m = /^다른 인식 결과: (.+)$/.exec(w);
    if (!m || v === null) return true;
    const alt = num(m[1]!);
    if (alt === null) return true;
    const big = Math.max(Math.abs(v), Math.abs(alt));
    const small = Math.min(Math.abs(v), Math.abs(alt));
    return !(big >= 10 && small * 10 < big);
  });
}

export function targetId(t: BizplanTarget): string {
  return t.kind === "info" ? `info:${t.key}` : `year:${t.year}:${t.col}`;
}
export function targetLabel(t: BizplanTarget): string {
  return t.kind === "info" ? INFO_LABEL[t.key] : `${t.year}년 ${t.col}`;
}

/** 사업자등록증 개업일 "19.03.02" → "2019.03.02". 두 자리 연도가 기준 연도보다 뒤면 1900년대. */
export function fullDate(yyMmDd: string, baseYear: number): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(yyMmDd);
  if (!m) return yyMmDd;
  const yy = Number(m[1]);
  const century = yy <= baseYear % 100 ? 2000 : 1900;
  return `${century + yy}.${m[2]}.${m[3]}`;
}

/**
 * 파서 결과 하나 → 팩트시트 제안. baseYear = 파싱할 때 준 기준 연도(매출 칸 Y 가 몇 년인지).
 * 반환 notes = 칸으로 못 옮긴 이유(사용자에게 그대로 보여 준다).
 */
export function suggestionsFromParse(
  docType: DocType,
  result: DocParseResult,
  baseYear: number,
  source: string,
): { suggestions: BizplanRawSuggestion[]; notes: string[] } {
  const out: BizplanRawSuggestion[] = [];
  const notes: string[] = [];
  const field = (key: string) => result.fields.find((f) => f.key === key && f.value !== "");
  const add = (target: BizplanTarget, value: string, confidence: number, warnings: string[] = [], valid?: boolean) => {
    if (!value.trim()) return;
    const ws = target.kind === "year" ? cleanWarnings(value, warnings) : warnings;
    out.push({ target, value: value.trim(), confidence, warnings: ws, source, ...(valid === undefined ? {} : { valid }) });
  };
  const salesYears = (col: BizplanYearCol) => {
    SALES_YEAR_KEYS.forEach((key, slot) => {
      const f = field(key);
      if (f) add({ kind: "year", year: String(baseYear - slot), col }, f.value, f.confidence, f.warnings, f.valid);
    });
  };

  if (docType === "사업자등록증") {
    const company = result.info?.find((i) => i.label === "상호")?.value;
    if (company) add({ kind: "info", key: "company" }, company, 0.6, ["사업자등록증의 상호예요. 확인해 주세요."]);
    const ceo = field("대표자이름");
    if (ceo) add({ kind: "info", key: "ceo" }, ceo.value, ceo.confidence, ceo.warnings, ceo.valid);
    const no = field("사업자등록번호");
    if (no) add({ kind: "info", key: "bizNo" }, no.value, no.confidence, no.warnings, no.valid);
    const cat = field("업태");
    const item = field("업종주생산품목");
    if (cat || item) {
      add(
        { kind: "info", key: "industry" },
        [cat?.value, item?.value].filter(Boolean).join(" / "),
        Math.min(cat?.confidence ?? 1, item?.confidence ?? 1),
        [...(cat?.warnings ?? []), ...(item?.warnings ?? [])],
      );
    }
    const opened = field("개업일");
    if (opened) add({ kind: "info", key: "founded" }, fullDate(opened.value, baseYear), opened.confidence, opened.warnings);
    const addr = field("소재지");
    if (addr) add({ kind: "info", key: "address" }, addr.value, addr.confidence, addr.warnings);
  } else if (docType === "재무제표") {
    salesYears("매출액");
    const fy = field("결산연도");
    const money: BizplanYearCol[] = ["영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"];
    const found = money.flatMap((col) => {
      const f = field(col);
      return f ? [{ col, f }] : [];
    });
    if (fy) {
      for (const { col, f } of found) add({ kind: "year", year: fy.value, col }, f.value, Math.min(f.confidence, fy.confidence), f.warnings);
    } else if (found.length > 0) {
      notes.push(`${source}: 사업연도를 못 찾아 이익·자산 숫자를 칸에 넣지 않았어요.`);
    }
  } else if (docType === "부가세과세표준증명") {
    salesYears("과세표준");
  }
  for (const w of result.documentWarnings) notes.push(`${source}: ${w}`);
  return { suggestions: out, notes };
}

function currentValue(draft: BizplanDraft, t: BizplanTarget): string | null {
  if (t.kind === "info") return draft[t.key];
  const y = draft.years.find((r) => r.year === t.year);
  return y ? y[t.col] : null;
}

const same = (a: string, b: string) => a.replace(/[\s,]/g, "") === b.replace(/[\s,]/g, "");

/**
 * 여러 파일의 제안을 팩트시트와 맞춘다.
 * - 팩트시트에 없는 연도 → 빼고 알린다.
 * - 같은 칸 제안이 여럿 → 확신도 높은 것 하나, 값이 다르면 「다른 서류에서는 …」 경고.
 * - 지금 값과 같으면 뺀다(바꿀 것 없음).
 * - 순서: 회사 정보 → 연도(오래된 해부터) × 열 순서.
 */
export function resolveSuggestions(
  raw: BizplanRawSuggestion[],
  draft: BizplanDraft,
): { rows: BizplanSuggestion[]; notes: string[] } {
  const notes: string[] = [];
  const outside = new Set<string>();
  const byId = new Map<string, BizplanRawSuggestion[]>();
  for (const s of raw) {
    if (currentValue(draft, s.target) === null) {
      if (s.target.kind === "year") outside.add(s.target.year);
      continue;
    }
    const id = targetId(s.target);
    byId.set(id, [...(byId.get(id) ?? []), s]);
  }
  if (outside.size > 0) {
    const ys = [...outside].sort().join("·");
    notes.push(`${ys}년 숫자는 팩트시트 연도 칸에 없어서 넣지 않았어요. 연도 칸을 바꾼 뒤 다시 읽으면 들어가요.`);
  }
  const rows: BizplanSuggestion[] = [];
  for (const [id, cands] of byId) {
    const score = (c: BizplanRawSuggestion) => (c.valid === false ? -1 : 0) + c.confidence;
    const best = cands.reduce((a, b) => (score(b) > score(a) ? b : a));
    const other = cands.find((c) => !same(c.value, best.value));
    const warnings = [...best.warnings];
    if (other) warnings.push(`다른 서류(${other.source})에서는 ${other.value}(으)로 읽혔어요.`);
    const current = currentValue(draft, best.target) ?? "";
    if (current && same(current, best.value)) continue;
    const confidence = other ? Math.max(0, best.confidence - 0.1) : best.confidence;
    rows.push({
      ...best,
      warnings,
      confidence,
      id,
      label: targetLabel(best.target),
      current,
      check: !current && confidence >= MIN_CHECK_CONFIDENCE && best.valid !== false,
    });
  }
  const rank = (t: BizplanTarget) =>
    t.kind === "info" ? INFO_ORDER.indexOf(t.key) : 100 + Number(t.year) * 10 + YEAR_COL_ORDER.indexOf(t.col);
  rows.sort((a, b) => rank(a.target) - rank(b.target));
  return { rows, notes };
}

/** 고른 제안만 팩트시트에 넣은 새 초안. */
export function applySuggestions(draft: BizplanDraft, chosen: BizplanSuggestion[]): BizplanDraft {
  const next: BizplanDraft = { ...draft, years: draft.years.map((y) => ({ ...y })) };
  for (const s of chosen) {
    const t = s.target;
    if (t.kind === "info") next[t.key] = s.value;
    else {
      const y = next.years.find((r) => r.year === t.year);
      if (y) y[t.col] = s.value;
    }
  }
  return next;
}

/** 읽기를 시작할 기준 연도 — 팩트시트 연도 칸 중 가장 늦은 해(없으면 fallback). */
export function bizplanBaseYear(draft: BizplanDraft, fallback: number): number {
  const ys = draft.years.map((y) => Number(y.year)).filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100);
  return ys.length > 0 ? Math.max(...ys) : fallback;
}

/** 칸(사업자등록증·재무제표·부가세) → 그 칸에 올렸을 법한 문서 종류. 글로 판별을 못 했을 때만 쓴다. */
export const SLOT_DOC_TYPE = { biz: "사업자등록증", fs: "재무제표", vat: "부가세과세표준증명" } as const satisfies Record<string, DocType>;
export type BizplanOcrSlot = keyof typeof SLOT_DOC_TYPE;
export const BIZPLAN_OCR_SLOTS = Object.keys(SLOT_DOC_TYPE) as BizplanOcrSlot[];
const OCR_TYPES: DocType[] = ["사업자등록증", "재무제표", "부가세과세표준증명"];

/** 글로 판별한 종류가 셋 중 하나면 그것, 아니면 올린 칸의 종류. */
export function pickDocType(classified: DocType, slot: BizplanOcrSlot): DocType {
  return OCR_TYPES.includes(classified) ? classified : SLOT_DOC_TYPE[slot];
}
