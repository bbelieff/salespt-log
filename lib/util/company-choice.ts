/**
 * Layer: util (순수 — import 0). 업체정보 선택형 칸 해석 (company-info-restructure 2026-09-28).
 *
 * - 사업자구분 · 과세유형 한 칸 선택: 선택지 5개가 두 저장 키(사업자구분 = 개인|법인,
 *   과세유형 = 일반과세자|간이과세자|면세사업자)를 함께 쓴다. 옛 값(과세유형 빈칸·자유 글)은
 *   고를 수 없는 "지금 값" 선택지로 그대로 보여 준다 — 저장된 글을 버리지 않는다.
 * - 소유여부(자가/임차): 옛 자유 글("임차 : 보 1000만, 월 50만")에서 선택을 짐작하고, 낱말 하나보다
 *   긴 옛 글은 따로 돌려준다(편집기가 "이전에 적은 내용"으로 보여 줌).
 * - 원 금액 칸: 숫자·쉼표만 친 입력은 천 단위 쉼표로 다시 찍는다("1,000만" 같은 옛 글은 그대로).
 */

export type BizOption = { value: string; label: string; 사업자구분: string; 과세유형: string };

/** 사업자구분 · 과세유형 선택지(belie 확정 5개). value = "구분|과세유형". */
export const BIZ_TYPE_OPTIONS: readonly BizOption[] = [
  { value: "개인|일반과세자", label: "개인 · 일반과세", 사업자구분: "개인", 과세유형: "일반과세자" },
  { value: "개인|간이과세자", label: "개인 · 간이과세", 사업자구분: "개인", 과세유형: "간이과세자" },
  { value: "개인|면세사업자", label: "개인 · 면세", 사업자구분: "개인", 과세유형: "면세사업자" },
  { value: "법인|일반과세자", label: "법인 · 일반과세", 사업자구분: "법인", 과세유형: "일반과세자" },
  { value: "법인|면세사업자", label: "법인 · 면세", 사업자구분: "법인", 과세유형: "면세사업자" },
];

/** 고를 수 없는 "지금 값" 선택지의 value — 옛 값·목록 밖 조합을 그대로 보여 줄 때. */
export const BIZ_TYPE_CURRENT = "__current__";

const compact = (s: string) => String(s ?? "").replace(/\s+/g, "");

/** 저장된 사업자구분 글 → "개인" | "법인" | null(모르는 글). */
export function normalizeBizKind(raw: string): "개인" | "법인" | null {
  const c = compact(raw);
  if (c === "개인" || c === "개인사업자" || c === "개인사업") return "개인";
  if (c === "법인" || c === "법인사업자" || c === "법인사업") return "법인";
  return null;
}

/** 저장된 과세유형 글 → 표준 3종 | null(모르는 글). */
export function normalizeTaxType(raw: string): "일반과세자" | "간이과세자" | "면세사업자" | null {
  const c = compact(raw);
  if (c === "일반과세자" || c === "일반과세" || c === "일반") return "일반과세자";
  if (c === "간이과세자" || c === "간이과세" || c === "간이") return "간이과세자";
  if (c === "면세사업자" || c === "면세" || c === "면세사업") return "면세사업자";
  return null;
}

const TAX_SHORT: Record<string, string> = {
  일반과세자: "일반과세",
  간이과세자: "간이과세",
  면세사업자: "면세",
};

/** 법인인가 — 법인등록번호 칸을 보여 줄지. */
export function isCorporation(사업자구분: string): boolean {
  return normalizeBizKind(사업자구분) === "법인";
}

export type BizTypeView = {
  /** select 의 value — "" = 미선택, BIZ_TYPE_CURRENT = 아래 current 선택지. */
  value: string;
  /** 목록 밖 지금 값(있을 때만) — 고를 수 없는(disabled) 선택지로 맨 위에 둔다. */
  current: { value: string; label: string } | null;
};

/** 저장된 두 칸 → 한 칸 select 상태. 목록에 없는 조합은 글 그대로 "지금 값" 선택지. */
export function bizTypeView(사업자구분: string, 과세유형: string): BizTypeView {
  const b = String(사업자구분 ?? "").trim();
  const t = String(과세유형 ?? "").trim();
  if (!b && !t) return { value: "", current: null };
  const nb = normalizeBizKind(b);
  const nt = normalizeTaxType(t);
  const hit = nb && nt ? BIZ_TYPE_OPTIONS.find((o) => o.사업자구분 === nb && o.과세유형 === nt) : undefined;
  if (hit) return { value: hit.value, current: null };
  const bLabel = b ? (nb ?? b) : "구분 선택";
  const tLabel = t ? (nt ? TAX_SHORT[nt]! : t) : "과세유형 선택";
  return { value: BIZ_TYPE_CURRENT, current: { value: BIZ_TYPE_CURRENT, label: `${bLabel} · ${tLabel}` } };
}

/**
 * 선택 → 저장할 두 칸. "" = 둘 다 비움. 목록 밖 value 면 null(아무것도 바꾸지 않음).
 * lost = 새 값으로 뜻이 옮겨지지 않는 옛 자유 글(편집기가 기타메모로 옮겨 보존한다).
 */
export function bizTypeChoose(
  value: string,
  prev: { 사업자구분: string; 과세유형: string },
): { 사업자구분: string; 과세유형: string; lost: string[] } | null {
  const lost: string[] = [];
  const b = String(prev.사업자구분 ?? "").trim();
  const t = String(prev.과세유형 ?? "").trim();
  if (b && !normalizeBizKind(b)) lost.push(`사업자구분: ${b}`);
  if (t && !normalizeTaxType(t)) lost.push(`과세유형: ${t}`);
  if (value === "") return { 사업자구분: "", 과세유형: "", lost };
  const o = BIZ_TYPE_OPTIONS.find((x) => x.value === value);
  if (!o) return null;
  return { 사업자구분: o.사업자구분, 과세유형: o.과세유형, lost };
}

export type OwnershipChoice = "자가" | "임차" | "";

/**
 * 저장된 소유여부 글 → 선택(자가/임차/모름) + 옛 글. 낱말 그대로("자가"/"임차")면 옛 글 없음.
 * 짐작 순서(belie 지시): 자가가 들어 있으면 자가, 아니면 임차(또는 월세·전세)면 임차.
 */
export function ownershipView(raw: string): { choice: OwnershipChoice; legacy: string } {
  const t = String(raw ?? "").trim();
  if (t === "" || t === "자가" || t === "임차") return { choice: t as OwnershipChoice, legacy: "" };
  const choice: OwnershipChoice = /자가/.test(t) ? "자가" : /임차|월세|전세/.test(t) ? "임차" : "";
  return { choice, legacy: t };
}

/** 기타메모 끝에 한 줄 덧붙인다(메모가 비었으면 그 줄만). */
export function appendMemoLine(memo: string, line: string): string {
  const m = String(memo ?? "").replace(/\s+$/, "");
  return m ? `${m}\n${line}` : line;
}

/** 숫자·쉼표만 친 원 금액 → 천 단위 쉼표. 그 밖의 글("1,000만")은 손대지 않는다. */
export function formatWonInput(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!/^[\d,]+$/.test(t)) return raw;
  const digits = t.replace(/,/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return raw;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 칸 옆 단위(원·㎡)를 붙여 보일지 — 비었거나 숫자뿐일 때만(옛 "1,000만"·"33㎡(10평)"엔 안 붙임). */
export function showsUnitSuffix(value: string): boolean {
  return /^[\d,.\s]*$/.test(String(value ?? ""));
}
