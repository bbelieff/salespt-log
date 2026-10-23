/**
 * Layer: util (순수 — import 0). 주민등록번호 정규화.
 *
 * - `normalizeRrn` / `sanitizeRrnTyping`: 업체정보 「주민등록번호」 칸 **저장·입력** 정규화 —
 *   13자리 전체를 `NNNNNN-NNNNNNN` 으로 저장한다(ADR-0035, belie 결정 2026-10-23 — 2026-09-28
 *   「앞자리만」 결정을 뒤집음). 6자리만 적은 옛 값 `NNNNNN-` 도 그대로 유효하다.
 * - `normalizeRrnFront`: 앞 6자리만 남긴다. **문서 자동입력(OCR·메모 해석)** 경로 전용 —
 *   문서에서 뒷자리를 읽어 오지 않는 규칙은 그대로 둔다(ADR-0035 §범위).
 *
 * normalizeRrnFront 규칙: 공백을 무시하고 **맨 앞 6자리가 숫자**면 `NNNNNN-` 로 저장한다.
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

/** 주민등록번호 숫자 최대 자릿수(앞 6 + 뒤 7). */
export const RRN_MAX_DIGITS = 13;

/**
 * 업체정보 주민등록번호 **저장** 정규화(ADR-0035). 숫자만 골라 최대 13자리를 남긴다.
 * 숫자가 6자리 미만이면 빈 문자열(앞자리도 다 안 적힌 값은 저장하지 않음 — 이전과 같음).
 * 6자리 이상이면 `앞6-뒤(0~7자리)`. 하이픈·공백 유무, 숫자 아닌 글자는 상관없다(던지지 않음).
 *   "YYMMDD-NNNNNNN" · "YYMMDDNNNNNNN" → "YYMMDD-NNNNNNN"
 *   "YYMMDD" · "YYMMDD-"              → "YYMMDD-"
 *   14자리 이상                         → 13자리까지만
 *   숫자 5자리 이하 · "abc"              → ""
 */
export function normalizeRrn(input: unknown): string {
  const digits = String(input ?? "").replace(/\D/g, "").slice(0, RRN_MAX_DIGITS);
  if (digits.length < 6) return "";
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/**
 * 업체정보 주민등록번호 **입력 중** 정규화(편집기 onChange, ADR-0035). 숫자·하이픈 외 글자는 버리고,
 * 숫자가 7자리째가 되는 순간 6자리 뒤에 하이픈을 넣는다. 13자리를 넘는 숫자는 버린다.
 * 정확히 6자리일 때는 하이픈을 지울 수 있게 되돌려 붙이지 않는다. 마무리(blur)·서버 저장은 normalizeRrn.
 */
export function sanitizeRrnTyping(input: unknown): string {
  const s = String(input ?? "").replace(/[^\d-]/g, "");
  const digits = s.replace(/-/g, "").slice(0, RRN_MAX_DIGITS);
  if (digits.length > 6) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  if (digits.length === 6) return s.startsWith(digits) ? s.slice(0, 7) : `${digits}-`;
  return digits;
}

/**
 * (옛 앞자리 전용 편집기 규칙 — 지금은 화면에서 쓰지 않음, 회귀 시험용으로 보존) 입력 **중** 정규화. 완성 전 값(숫자 1~5자리)은 그대로 두어 타이핑을
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

/**
 * 생년월일 글 → 주민등록번호 앞자리 `YYMMDD-` (company-finance-won-grid, belie 2026-09-28).
 * 편집기는 주민등록번호가 비었을 때 이 값을 **보여 주기만** 하고(열기만 해서 저장하지 않음),
 * 사용자가 무엇이든 고칠 때 apply() 가 함께 저장한다. 못 읽으면 "".
 *   "88.01.24" · "1988-01-24" · "880124" · "19880124" · "1988년 1월 24일" → "880124-"
 */
export function birthToRrnFront(input: unknown): string {
  const s = String(input ?? "").replace(/\s+/g, "");
  const m =
    s.match(/^(\d{2})(\d{2})(\d{2})$/) ??
    s.match(/^\d{2}(\d{2})(\d{2})(\d{2})$/) ??
    s.match(/^(?:\d{2})?(\d{2})[.\-/년](\d{1,2})[.\-/월](\d{1,2})일?\.?$/);
  if (!m) return "";
  const [yy, mm, dd] = [m[1]!, m[2]!.padStart(2, "0"), m[3]!.padStart(2, "0")];
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return "";
  return `${yy}${mm}${dd}-`;
}
