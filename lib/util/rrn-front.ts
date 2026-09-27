/**
 * Layer: util (순수 — import 0). 주민등록번호 **앞자리만** 남기는 정규화.
 *
 * 왜 필요한가(belie 결정 2026-09-28): 업체정보 「주민등록번호 앞자리」 칸은 대표자 생년월일
 * 6자리만 저장한다. 뒷자리(성별·지역 식별번호)는 **어떤 경로로도 저장하지 않는다** —
 * 화면이 실수로 전체 번호를 보내도 서버 저장 직전(CompanyInfo zod transform)에서 다시 자른다.
 *
 * 규칙: 공백을 무시하고 **맨 앞 6자리가 숫자**면 `NNNNNN-` 로 저장한다.
 * 맨 앞 6자리가 숫자가 아니면(입력 중인 5자리, 한글 등) 빈 문자열 — 뒷자리가 섞인 값을
 * 그대로 남기는 일은 없다.
 *   "800101-1234567" → "800101-" · "8001011234567" → "800101-"
 *   "800101 - 1"     → "800101-" · "800101"        → "800101-"
 *   "80010"          → ""        · "abc"           → ""
 */
export function normalizeRrnFront(input: unknown): string {
  const s = String(input ?? "").replace(/\s+/g, "");
  const m = s.match(/^(\d{6})/);
  return m ? `${m[1]}-` : "";
}

/**
 * 입력 **중** 정규화(편집기 onChange). 완성 전 값(숫자 1~5자리)은 그대로 두어 타이핑을
 * 방해하지 않고, 숫자가 6자리를 넘는 순간(뒷자리를 치기 시작하거나 전체를 붙여넣음)
 * 곧바로 `NNNNNN-` 로 잘라 뒷자리가 화면·자동저장에 한 글자도 남지 않게 한다.
 * 숫자·하이픈 외 글자는 버린다. 마무리(blur)·서버 저장은 normalizeRrnFront 가 담당.
 */
export function sanitizeRrnFrontTyping(input: unknown): string {
  const s = String(input ?? "").replace(/[^\d-]/g, "");
  const digits = s.replace(/-/g, "");
  if (digits.length > 6) return `${digits.slice(0, 6)}-`;
  if (digits.length === 6) return s.startsWith(digits) ? s.slice(0, 7) : `${digits}-`;
  return digits;
}
