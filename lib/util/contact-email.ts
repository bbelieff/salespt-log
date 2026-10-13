/**
 * 업체정보 [대표자] 이메일 칸 — 거래처(대표) 연락용 주소의 정리·모양 검사 (company-info-email, 2026-10).
 * 순수 유틸(import 0 — period-hardcode.test 의 lib/util 순수성). 편집기 칸(components)과 미팅 메모 파서
 * (lib/document-ocr — @/util 만 import 가능)가 함께 쓴다.
 *
 * 로그인 이메일 정리(lib/analytics/save-observability — trim + 소문자)와 다르다: 여기는 **대소문자를 그대로**
 * 두고, 적은 글을 바꾸는 범위를 최소로 한다(막지 않는 자유 텍스트 칸 — "적은 그대로 저장").
 */

/** "mailto:" 접두(대소문자 무관). */
const MAILTO = /^mailto:/i;

/**
 * 칸을 벗어날 때(blur)·메모 자동입력 때 한 번 정리한다.
 * - 앞뒤 공백 제거 · 전각 ＠/．→ @/. · 맨 앞 "mailto:" 제거.
 * - "@" 가 정확히 하나일 때만 "@" 양옆 공백을 붙인다("ceo @ example.com" → "ceo@example.com").
 * - "." 양옆 공백은 건드리지 않는다 — 여러 주소·문장("a@x.com. b@y.co.kr")을 합쳐 버리지 않게.
 */
export function tidyContactEmail(raw: string): string {
  let v = raw.trim().replace(/＠/g, "@").replace(/．/g, ".");
  v = v.replace(MAILTO, "").trim();
  if ((v.match(/@/g) ?? []).length === 1) v = v.replace(/\s*@\s*/, "@");
  return v;
}

/** 주소 한 개의 모양 — 로컬부@도메인(점으로 나뉜 두 마디 이상). 일부러 느슨하다(오타 도메인은 못 잡음). */
const ONE_ADDRESS = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * 이메일 모양인지 — 막지 않는 안내(amber)에만 쓴다. 빈 값은 true(안내 없음).
 * 쉼표·세미콜론·공백으로 나눈 여러 주소를 허용하고, 앞뒤에 남은 구분자로 생긴 빈 조각은 무시한다("a@x.com,").
 */
export function looksLikeContactEmail(value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  const pieces = v.split(/[,;]\s*|\s+/).filter((p) => p !== "");
  return pieces.length > 0 && pieces.every((p) => ONE_ADDRESS.test(p));
}
