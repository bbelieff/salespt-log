/**
 * Layer: types — 계약(02) 분류 판정 단일 결정점. 클라(UI)·서버 공용(googleapis 비의존).
 * index.ts 500줄 캡으로 분리(2026-07-12) — 호출부는 기존대로 `@/types` 배럴 경유.
 */

/** 이월(아레나 비집계) 판정 — 읽기시점 분류(arena-start-revenue-split).
 *  깃발(AI=이월) OR 계약일<시작일(courseStart=O1, 동적·하드코딩X). 날짜는 ISO일 때만 비교. */
export function isCarryoverContract(
  p: { 구분?: string; 계약일?: string },
  courseStartISO: string,
): boolean {
  if ((p.구분 ?? "").trim() === "이월") return true;
  const d = (p.계약일 ?? "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return iso.test(d) && iso.test(courseStartISO) && d < courseStartISO;
}

/** 해지 판정 (contract-termination 2026-07-12) — `해지일` 존재 = 해지. */
export function isTerminatedContract(p: { 해지일?: string }): boolean {
  return (p.해지일 ?? "").trim() !== "";
}

/** 해지 계약의 건수 포함 여부 — 기본 제외 + "해지 N건" 별도 표시.
 *  (belie 미확정 — 정책이 바뀌면 이 상수 하나만 뒤집는다, contract-termination 스펙) */
export const TERMINATED_IN_CONTRACT_COUNT = false;
