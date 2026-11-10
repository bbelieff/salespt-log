/**
 * document-ocr/diff — 여러 문서의 제안을 칸별로 모아 비교표 행을 만들고, 체크된 칸만 반영값으로 뽑는다.
 *
 * 기본 체크 규칙(belie 확정 2026-09-28):
 * - 지금 값이 비었고 읽은 값이 있으면 → 체크.
 * - 지금 값이 있으면 → 체크 해제 + "지금 값이 있어 기본으로 안 덮어요".
 * - 읽은 값이 비면 → 행 자체가 없다(빈 값은 절대 덮지 않는다).
 * - 형식 검증 실패(사업자등록번호 체크섬 등) → 체크 해제 + 경고.
 * - 두 문서가 같은 칸에 다른 값을 내면 → 충돌 표시, 정확도 높은 쪽이 기본 선택.
 * - 사업자등록번호가 다른 회사 서류(otherCompanyFiles)에서만 나온 값 → 체크 해제 + 경고(MSC 이식 2026-11-01).
 *
 * [재무] 금액 칸(백만원, company-finance-won-grid)은 비교표에서 "250.1백만원 (원문 250,123,456원)" 으로
 * 보여 준다(displayValue·sourceNote). 매출 칸을 채우는데 업체에 기준 연도가 없으면 반영값에
 * 매출기준연도도 함께 넣는다(withBaseYear) — 칸 이름(Y·Y-1…)이 읽은 문서 연도와 어긋나지 않게.
 */
import { normalizeRrnFront } from "@/util/rrn-front";
import { SALES_BASE_YEAR_KEY } from "@/util/company-sales";
import { isMoneyKey, isSignedMoneyKey, moneyWithUnit } from "@/util/company-money";
import type { CompanyInfo } from "@/types";
import { groupThousands } from "./amount";
import { digitsOnly, formatBizNo, isValidBizNo } from "./bizno";
import type { CompanyInfoKey, ParsedField } from "./types";

export type Accuracy = "높음" | "보통" | "낮음";

export function accuracyOf(confidence: number): Accuracy {
  if (confidence >= 0.8) return "높음";
  if (confidence >= 0.5) return "보통";
  return "낮음";
}

export type Candidate = {
  value: string;
  confidence: number;
  warnings: string[];
  valid?: boolean;
  /** 금액 칸: 문서의 원 금액(가장 정확한 후보 기준). */
  sourceWon?: number;
  /** 이 값을 낸 파일 이름들(같은 값이면 합친다). */
  sources: string[];
};

export type DiffRow = {
  key: CompanyInfoKey;
  current: string;
  /** 정확도 내림차순. [0] 이 기본 선택. */
  candidates: Candidate[];
  conflict: boolean;
  defaultChecked: boolean;
  /** candidates[0] 기준 안내(없으면 ""). 다른 후보를 고르면 checkState 로 다시 구한다. */
  note: string;
};

export type FileProposal = { fileName: string; fields: ParsedField[] };

export const KEEP_NOTE = "지금 값이 있어 기본으로 안 덮어요";
export const SAME_NOTE = "지금 값과 같아요";
// 사업자등록번호(검증번호)·이메일(모양) 공용 — "번호"라고 쓰면 이메일 칸에서 틀린 말이 된다(company-info-email-v2).
export const INVALID_NOTE = "형식이 맞지 않아 기본으로 안 넣어요";
export const OTHER_COMPANY_NOTE = "다른 회사 서류에서 읽은 값이라 기본으로 안 넣어요";

/**
 * 다른 회사 서류 찾기 — 파일마다 읽은 사업자등록번호(검증식 통과한 것만: 오독으로 같은 회사를 남으로 보지 않게)를
 * 기준 번호와 비교한다. 기준 = 업체정보의 번호(맞는 번호일 때), 없으면 서류들에서 가장 많이 나온 번호.
 * 돌려주는 값: 파일 이름 → 그 서류의 번호(000-00-00000). 출처: MSC 리드디벨롭 `markOtherCompany`(L-160).
 */
export function otherCompanyFiles(currentBizNo: string, proposals: FileProposal[]): Map<string, string> {
  const noOf = new Map<string, string>();
  for (const p of proposals) {
    const f = p.fields.find((x) => x.key === "사업자등록번호" && x.valid !== false);
    const d = f ? digitsOnly(f.value) : "";
    if (d.length === 10 && isValidBizNo(d)) noOf.set(p.fileName, d);
  }
  const cur = digitsOnly(currentBizNo);
  let target = cur.length === 10 && isValidBizNo(cur) ? cur : "";
  if (!target) {
    const count = new Map<string, number>();
    for (const n of noOf.values()) count.set(n, (count.get(n) ?? 0) + 1);
    target = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }
  const out = new Map<string, string>();
  if (!target) return out;
  for (const [file, n] of noOf) if (n !== target) out.set(file, formatBizNo(n));
  return out;
}

/** 반영 직전 값 정리 — 문서에서 읽은 주민등록번호는 앞 6자리만(뒷자리는 문서에서 읽지 않는다, ADR-0035 §범위). */
export function sanitizeForKey(key: CompanyInfoKey, value: string): string {
  const v = value.trim();
  return key === "주민등록번호" ? normalizeRrnFront(v) : v;
}

/** 지금 값과 고른 후보로 기본 체크·안내 문구를 정한다(충돌 행에서 다른 후보를 고르면 다시 부른다). */
export function checkState(current: string, top: Candidate): { checked: boolean; note: string } {
  if (top.valid === false) return { checked: false, note: INVALID_NOTE };
  if (current.trim() === top.value.trim()) return { checked: false, note: SAME_NOTE };
  if (current.trim() !== "") return { checked: false, note: KEEP_NOTE };
  return { checked: true, note: "" };
}

/** 선택 값을 바꿨을 때(충돌 행) 체크 기본값 다시 계산. */
export function defaultCheckFor(current: string, candidate: Candidate): boolean {
  return checkState(current, candidate).checked;
}


export function buildDiffRows(
  current: Partial<CompanyInfo>,
  proposals: FileProposal[],
  order: readonly string[] = [],
  otherFiles: ReadonlySet<string> = new Set(),
): DiffRow[] {
  const byKey = new Map<CompanyInfoKey, Candidate[]>();
  for (const p of proposals) {
    for (const f of p.fields) {
      const value = sanitizeForKey(f.key, f.value);
      if (!value) continue;
      const list = byKey.get(f.key) ?? [];
      const same = list.find((c) => c.value === value);
      if (same) {
        if (!same.sources.includes(p.fileName)) same.sources.push(p.fileName);
        if (f.confidence > same.confidence) {
          Object.assign(same, { confidence: f.confidence, warnings: f.warnings, valid: f.valid, sourceWon: f.sourceWon });
        }
      } else {
        list.push({
          value,
          confidence: f.confidence,
          warnings: [...f.warnings],
          valid: f.valid,
          ...(f.sourceWon === undefined ? {} : { sourceWon: f.sourceWon }),
          sources: [p.fileName],
        });
      }
      byKey.set(f.key, list);
    }
  }
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const rows: DiffRow[] = [];
  for (const [key, list] of byKey) {
    // 검증 통과 값이 실패 값보다, 그다음 정확도 높은 값이 앞.
    const candidates = [...list].sort(
      (a, b) => Number(b.valid !== false) - Number(a.valid !== false) || b.confidence - a.confidence,
    );
    const cur = String(current[key] ?? "");
    // 주민등록번호: 문서는 앞 6자리만 준다 — 지금 값(13자리, ADR-0035)의 앞자리와 같으면 「같아요」로 두어
    // 기본 체크로 뒷자리를 지우지 않게 한다.
    const sameRrnFront = key === "주민등록번호" && cur.trim() !== "" && normalizeRrnFront(cur) === candidates[0]!.value;
    const fromOther = candidates[0]!.sources.every((s) => otherFiles.has(s));
    const { checked, note } = sameRrnFront
      ? { checked: false, note: SAME_NOTE }
      : fromOther
        ? { checked: false, note: OTHER_COMPANY_NOTE }
        : checkState(cur, candidates[0]!);
    rows.push({ key, current: cur, candidates, conflict: candidates.length > 1, defaultChecked: checked, note });
  }
  return rows.sort((a, b) => rank(a.key) - rank(b.key));
}

/** 체크된 행만 반영값으로. 빈 값은 절대 넣지 않는다. */
export function selectedPatch(
  rows: DiffRow[],
  checked: Record<string, boolean>,
  choice: Record<string, number>,
): Partial<Record<CompanyInfoKey, string>> {
  const out: Partial<Record<CompanyInfoKey, string>> = {};
  for (const row of rows) {
    if (!checked[row.key]) continue;
    const c = row.candidates[choice[row.key] ?? 0] ?? row.candidates[0];
    const value = c ? sanitizeForKey(row.key, c.value) : "";
    if (value) out[row.key] = value;
  }
  return out;
}

/** 충돌 행 고르기 상자의 한 줄 이름 — 여러 줄 값은 첫 줄 + " 외"(option 은 줄바꿈을 못 보여 준다). */
export function optionLabel(value: string): string {
  const lines = value.split("\n").filter((l) => l.trim());
  return lines.length > 1 ? `${lines[0]} 외` : value;
}

/** 비교표에 보일 값 — 금액 칸의 숫자는 "250.1백만원", 그 밖(옛 자유 글·다른 칸)은 그대로. */
export function displayValue(key: string, value: string): string {
  return isMoneyKey(key) ? moneyWithUnit(value, isSignedMoneyKey(key)) : value;
}

/** 금액 후보의 원문 표기 "원문 250,123,456원" (원 금액이 없으면 ""). */
export function sourceNote(c: Candidate): string {
  return c.sourceWon === undefined ? "" : `원문 ${groupThousands(c.sourceWon)}원`;
}

/**
 * 반영값에 매출 칸이 있는데 업체에 기준 연도가 비었으면 기준 연도(파서가 칸을 고른 해)를 함께 넣는다.
 * 이미 기준 연도가 있거나 금액 칸이 없으면 그대로.
 */
export function withBaseYear(
  patch: Partial<Record<CompanyInfoKey, string>>,
  current: Partial<CompanyInfo>,
  baseYear: number,
): Partial<Record<CompanyInfoKey, string>> {
  if (String(current[SALES_BASE_YEAR_KEY as CompanyInfoKey] ?? "").trim()) return patch;
  if (!Object.keys(patch).some(isMoneyKey)) return patch;
  return { ...patch, [SALES_BASE_YEAR_KEY]: String(baseYear) };
}
