/**
 * document-ocr/diff — 여러 문서의 제안을 칸별로 모아 비교표 행을 만들고, 체크된 칸만 반영값으로 뽑는다.
 *
 * 기본 체크 규칙(belie 확정 2026-09-28):
 * - 지금 값이 비었고 읽은 값이 있으면 → 체크.
 * - 지금 값이 있으면 → 체크 해제 + "지금 값이 있어 기본으로 안 덮어요".
 * - 읽은 값이 비면 → 행 자체가 없다(빈 값은 절대 덮지 않는다).
 * - 형식 검증 실패(사업자등록번호 체크섬 등) → 체크 해제 + 경고.
 * - 두 문서가 같은 칸에 다른 값을 내면 → 충돌 표시, 정확도 높은 쪽이 기본 선택.
 */
import { normalizeRrnFront } from "@/util/rrn-front";
import type { CompanyInfo } from "@/types";
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
export const INVALID_NOTE = "번호가 맞지 않아 기본으로 안 넣어요";

/** 반영 직전 값 정리 — 주민등록번호 칸은 어떤 경로로도 앞 6자리만. */
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
          Object.assign(same, { confidence: f.confidence, warnings: f.warnings, valid: f.valid });
        }
      } else {
        list.push({ value, confidence: f.confidence, warnings: [...f.warnings], valid: f.valid, sources: [p.fileName] });
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
    const { checked, note } = checkState(cur, candidates[0]!);
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

/** 충돌 행 고르기 상자의 한 줄 이름 — 여러 줄 값(반기별매출)은 첫 줄 + " 외"(option 은 줄바꿈을 못 보여 준다). */
export function optionLabel(value: string): string {
  const lines = value.split("\n").filter((l) => l.trim());
  return lines.length > 1 ? `${lines[0]} 외` : value;
}
