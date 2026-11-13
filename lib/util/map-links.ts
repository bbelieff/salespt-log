/**
 * 길찾기 지도 앱 주소 만들기(2026-11-07 belie — 카카오맵·네이버지도·티맵, 주소가 검색된 화면으로).
 * 순수 함수(import 0). 폰 종류별로 앱을 여는 주소와 앱이 없을 때 갈 주소를 돌려준다.
 * - 안드로이드: intent:// + S.browser_fallback_url — 앱이 없으면 브라우저가 대신 연다(크롬 공식 방식).
 * - 아이폰·기타: 앱 주소(kakaomap:// 등)를 연 뒤, 화면이 그대로면 대신 갈 주소로.
 * 앱별 주소 형식은 각 앱 공개 안내 기준이며 실기기 확인 항목이다(문서 docs/plans/active/mobile-call-assist.md).
 */
export type MapAppId = "kakao" | "naver" | "tmap";
export const MAP_APPS: { id: MapAppId; name: string }[] = [
  { id: "kakao", name: "카카오맵" },
  { id: "naver", name: "네이버지도" },
  { id: "tmap", name: "티맵" },
];
export type Platform = "android" | "ios" | "other";

export function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && /mobile/i.test(ua))) return "ios";
  return "other";
}

const PKG: Record<MapAppId, string> = { kakao: "net.daum.android.map", naver: "com.nhn.android.nmap", tmap: "com.skt.tmap.ku" };

/** 앱 안에서 그 주소를 검색한 화면을 여는 주소(스킴 포함). appName = 네이버지도가 요구하는 호출 앱 이름(도메인). */
export function appUrl(app: MapAppId, query: string, appName: string): string {
  const q = encodeURIComponent(query);
  if (app === "kakao") return `kakaomap://search?q=${q}`;
  if (app === "naver") return `nmap://search?query=${q}&appname=${encodeURIComponent(appName)}`;
  return `tmap://search?name=${q}`;
}

/** 앱이 없을 때 — 카카오맵·네이버지도는 웹 지도 검색, 티맵은 설치 화면. */
export function fallbackUrl(app: MapAppId, query: string, platform: Platform): string {
  const q = encodeURIComponent(query);
  if (app === "kakao") return `https://map.kakao.com/link/search/${q}`;
  if (app === "naver") return `https://map.naver.com/p/search/${q}`;
  return platform === "ios" ? "https://apps.apple.com/kr/app/id431589174" : `https://play.google.com/store/apps/details?id=${PKG.tmap}`;
}

/** 실제로 열 주소. 안드로이드는 intent 한 줄(앱 없으면 fallback 으로), 그 밖은 앱 주소 + 나중에 쓸 fallback. */
export function mapLaunch(app: MapAppId, query: string, platform: Platform, appName: string): { open: string; fallback: string | null } {
  const fallback = fallbackUrl(app, query, platform);
  const direct = appUrl(app, query, appName);
  if (platform === "android") {
    const [scheme, rest] = direct.split("://");
    return { open: `intent://${rest}#Intent;scheme=${scheme};package=${PKG[app]};S.browser_fallback_url=${encodeURIComponent(fallback)};end`, fallback: null };
  }
  if (platform === "ios") return { open: direct, fallback };
  // PC 등 — 앱이 없으니 웹 지도(티맵은 웹 지도가 없어 카카오맵 웹으로).
  return { open: app === "tmap" ? fallbackUrl("kakao", query, platform) : fallback, fallback: null };
}

/** 지도에 넣을 검색어 — 장소 칸이 비었거나 「사무실」처럼 주소가 아니면 업체 주소를 쓴다. */
const looksAddress = (s: string) => /(시|군|구|동|읍|면|로|길)\s*\d|[가-힣]+(로|길)\b|\d+-\d+/.test(s);

/** 번지·도로명 번호가 없어 근처까지만 안내되는 주소(예: 「경기 부천시 오정구 삼정동」). */
export const isVagueAddress = (s: string): boolean => !/\d/.test(s);

export type RouteSource = "own" | "place" | "company";
export interface RouteCandidate { source: RouteSource; address: string }

/**
 * 길찾기에 쓸 주소 후보를 믿을 만한 순서로(2026-11-12 belie 「가장 신빙성있는걸 가져오기」). 첫 후보가 기본값.
 * 직접 적은 주소 → 미팅 장소(번호까지 있는 주소일 때 — 그 미팅이 실제로 열리는 곳) → 업체정보 소재지
 * (사업자등록증 판독·간편인증이 채우는 칸) → 미팅 장소(그 밖). 주소 모양이 아닌 장소는 다른 후보가 없을 때만.
 */
export function routeCandidates(place: string | undefined, address: string | undefined, own?: string): RouteCandidate[] {
  const p = (place ?? "").trim(), a = (address ?? "").trim(), o = (own ?? "").trim();
  const out: RouteCandidate[] = [];
  const add = (source: RouteSource, v: string) => { if (v && !out.some((c) => c.address === v)) out.push({ source, address: v }); };
  add("own", o);
  const placeIsAddress = !!p && looksAddress(p);
  if (placeIsAddress && !isVagueAddress(p)) add("place", p);
  add("company", a);
  if (placeIsAddress || out.length === 0) add("place", p);
  return out;
}

export function mapQuery(place: string | undefined, address: string | undefined): string {
  const p = (place ?? "").trim(), a = (address ?? "").trim();
  if (p && looksAddress(p)) return p;
  if (a) return a;
  return p;
}
