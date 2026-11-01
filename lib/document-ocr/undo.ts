/**
 * document-ocr/undo — 「문서로 자동입력」 한 번 반영한 묶음을 통째로 되돌리기(순수 함수).
 * 출처: MSC 리드디벨롭 apply 뒤 알림의 「되돌리기」(L-169·L-174, 2026-11-01 이식).
 *
 * 반영 직전 값(before)과 반영한 값(filled)을 들고 있다가, 되돌릴 때는 **아직 반영한 값 그대로인 칸만**
 * 이전 값으로 돌린다 — 반영 뒤 사용자가 직접 고친 칸은 건드리지 않는다.
 */
import type { CompanyInfo } from "@/types";
import type { CompanyInfoKey } from "./types";

export type DocFill = {
  before: Partial<Record<CompanyInfoKey, string>>;
  filled: Partial<Record<CompanyInfoKey, string>>;
};

export function docFillOf(current: Partial<CompanyInfo>, patch: Partial<Record<CompanyInfoKey, string>>): DocFill {
  const before: DocFill["before"] = {};
  for (const k of Object.keys(patch) as CompanyInfoKey[]) before[k] = String(current[k] ?? "");
  return { before, filled: { ...patch } };
}

/** 아직 문서 값 그대로인 칸 — 노란 표시·되돌리기 대상. */
export function untouchedKeys(fill: DocFill, current: Partial<CompanyInfo>): CompanyInfoKey[] {
  return (Object.keys(fill.filled) as CompanyInfoKey[]).filter(
    (k) => String(current[k] ?? "") === fill.filled[k] && fill.before[k] !== fill.filled[k],
  );
}

export function undoPatch(fill: DocFill, current: Partial<CompanyInfo>): Partial<Record<CompanyInfoKey, string>> {
  const out: Partial<Record<CompanyInfoKey, string>> = {};
  for (const k of untouchedKeys(fill, current)) out[k] = fill.before[k] ?? "";
  return out;
}
