/**
 * DB관리시트 업체 동일성 — 화면(가져오기·직접 등록 경고)과 서버(저장 차단)가 같은 판정을 쓴다.
 * 순수 함수, import 없음. (2026-10-19 구조 개선 ⑥: 전에는 화면·서버가 같은 규칙을 따로 들고 있었다.)
 */

/** 국제·광고 접두를 국내 번호 숫자로 — "p:+82 10-1234-5678" · "+82 010…" · "+821012345678" → "01012345678". */
export function domesticPhoneDigits(raw: string): string {
  const s = raw.replace(/^p:/i, "").trim();
  const intl = s.match(/^\+82\s*(.*)$/);
  const digits = (intl ? intl[1]! : s).replace(/\D/g, "");
  return intl && digits && !digits.startsWith("0") ? `0${digits}` : digits;
}

/** 휴대폰(010 등 11자리)이면 010-1234-5678 꼴로, 아니면 원문 그대로. 서버 저장 정리용. */
export function formatMobilePhone(raw: string): string {
  const d = domesticPhoneDigits(raw);
  return /^01[016789]\d{8}$/.test(d) ? d.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3") : raw;
}

export const companyKey = (value: string) => value.normalize("NFKC").replace(/\s/g, "").toLowerCase();
export const bizKey = (value: string) => value.replace(/\D/g, "");

export type LeadIdentity = { phone: string; company: string; biz: string };

/** 같은 업체인가 — 사업자번호 10자리 일치 · 이름(공백·대소문자 무시) 일치 · 전화 9자리 이상 일치 중 하나. */
export function isSameLead(a: LeadIdentity, b: LeadIdentity): boolean {
  const biz = bizKey(a.biz);
  const company = companyKey(a.company);
  const phone = domesticPhoneDigits(a.phone);
  return (biz.length === 10 && biz === bizKey(b.biz))
    || (!!company && company === companyKey(b.company))
    || (phone.length >= 9 && phone === domesticPhoneDigits(b.phone));
}
