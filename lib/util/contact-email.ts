/**
 * 업체정보 [대표자] 이메일 칸 — 정리·모양 검사 (company-info-email-v2, 2026-11-10).
 * 순수 유틸(import 0). 편집기 칸(components)과 미팅 메모 파서(lib/document-ocr)가 함께 쓴다.
 *
 * 로그인 이메일 정리(trim + 소문자)와 다르다: 여기는 **대소문자를 그대로** 두고 적은 글을 최소로만 고친다
 * (막지 않는 자유 텍스트 칸 — "적은 그대로 저장").
 */

/**
 * 칸을 벗어날 때(blur)·메모 자동입력 때 한 번 정리한다.
 * - 앞뒤 공백 제거 · 전각 ＠/．→ @/. · 맨 앞 "mailto:" 제거.
 * - "@" 가 정확히 하나일 때만 "@" 양옆 공백을 붙인다("ceo @ example.com" → "ceo@example.com").
 */
export function tidyContactEmail(raw: string): string {
  let v = raw.trim().replace(/＠/g, "@").replace(/．/g, ".");
  v = v.replace(/^mailto:/i, "").trim();
  if ((v.match(/@/g) ?? []).length === 1) v = v.replace(/\s*@\s*/, "@");
  return v;
}

/** 주소 한 개의 모양 — 로컬부@도메인(점으로 나뉜 두 마디 이상). 일부러 느슨하다. */
const ONE_ADDRESS = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * 이메일 모양인지 — 막지 않는 안내(amber)·메모 자동입력 기본 체크에만 쓴다. 빈 값은 true(안내 없음).
 * 쉼표·세미콜론·공백으로 나눈 여러 주소를 허용한다.
 */
export function looksLikeContactEmail(value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  const pieces = v.split(/[,;]\s*|\s+/).filter((p) => p !== "");
  return pieces.length > 0 && pieces.every((p) => ONE_ADDRESS.test(p));
}
