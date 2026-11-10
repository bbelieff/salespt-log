/**
 * 문자 앱 열기 주소(sms:) — 폰의 기본 문자 앱(삼성 메시지·구글 메시지·아이폰 메시지)을
 * 받는 사람·본문이 채워진 채로 연다. 보내기는 본인이 누른다(belie 2026-11-10, 문자 발송 API 대신 ①안).
 *
 * - 번호가 있으면 `sms:<숫자>?&body=` — 안드로이드(?body)와 iOS(&body)가 둘 다 읽는 모양.
 * - 번호가 없으면 iOS 는 `sms:&body=`, 그 밖은 `sms:?body=` (받는 사람은 앱에서 고른다).
 */
export function smsHref(phone: string, body: string, ios: boolean): string {
  const digits = phone.replace(/\D/g, "");
  const enc = encodeURIComponent(body);
  if (digits) return `sms:${digits}?&body=${enc}`;
  return ios ? `sms:&body=${enc}` : `sms:?body=${enc}`;
}
