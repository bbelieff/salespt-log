/**
 * Layer: util (순수 — import 0). 통화에서 들은 미팅 장소가 「업장·사무실·가게」처럼 업체 자리를 가리키는 말뿐인지.
 * 그런 말은 그 자체로는 쓸모가 없어 업체 주소(소재지)로 바꾼다(belie 2026-11-05: 「업장에서 만나자」 → 서울시 서초구).
 * 「역삼역 3번 출구 투썸」처럼 실제 장소가 있으면 그대로 둔다.
 */
const SELF_PLACE = /^(제|저희|우리|대표님|저|그)?\s*(업장|사업장|매장|가게|점포|식당|사무실|회사|공장|공방|작업장|본사|지점)(\s*(사무실|안|쪽|으로|에서|로))*$/;

export const isSelfPlace = (place: string) => !place.trim() || SELF_PLACE.test(place.trim());

/** 업체 자리를 가리키는 말이면 주소로, 아니면 들은 장소 그대로. 주소가 없으면 들은 말을 남긴다. */
export const meetingPlace = (said: string, address: string) => (address.trim() && isSelfPlace(said) ? address.trim() : said.trim());
