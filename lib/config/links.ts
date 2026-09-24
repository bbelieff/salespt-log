/**
 * Layer: config — 앱이 바깥으로 내보내는 링크 상수.
 *
 * 왜 상수로 두나: 주소가 바뀌면 **여기 한 줄만** 고치면 된다. 컴포넌트에 흩어 두면
 * 어디를 고쳐야 하는지 찾아야 하고, 하나를 빠뜨린다.
 */

/**
 * 업무매뉴얼(노션) — 실무·수납 탭 상단 바로가기.
 * 2026-09-05 belie 제공. 공개 노션 페이지(로그인 불요).
 */
export const WORK_MANUAL_URL =
  "https://climbing-caraway-ec3.notion.site/65b3fa7fca00835283dd0126f54d2b4f";

/**
 * 사용 가이드 — **네이버 카페 「경영일지 사용법」 게시판** (2026-09-07 belie).
 *
 * ## 왜 노션에서 카페로 옮겼나
 * 노션 가이드가 오래돼 있었다. 그런데 **카페 게시판에 더 많고 최신인 자료가 이미 쌓여 있고**,
 * 경영일지를 쓰는 사람은 **전원 카페 회원**이라 가입 벽이 없다. 낡은 문서를 따로 갱신해
 * 관리 대상을 둘로 늘리는 것보다, 이미 살아 있는 곳으로 보내는 편이 낫다.
 *
 * ## 왜 env 가 아니라 코드에 두나
 * 이전엔 `NEXT_PUBLIC_GUIDE_URL` 환경변수였는데, 그 값은 **VPS 에만 있어** 주소를 바꾸려면
 * 서버에 들어가야 했다. `NEXT_PUBLIC_*` 은 어차피 **빌드할 때 박히는 값**이라 env 로 둬도
 * 재배포가 필요하다 — 즉 env 로 둬서 얻는 이점이 없었다. 코드에 두면 PR 한 줄로 바뀌고
 * 이력도 남는다. (env 가 설정돼 있으면 그쪽이 이긴다 — 급할 때 서버에서 덮을 여지는 남겨둔다.)
 */
export const GUIDE_URL =
  "https://cafe.naver.com/f-e/cafes/31423785/menus/152?viewType=L";

/**
 * 정책자금 데일리 — 실무(수납) 탭에서 오늘 뜬 공고로 건너가는 문 (2026-09-18 belie).
 *
 * ## 왜 `/news/latest` 인가 — 날짜를 박으면 다음 날 죽는다
 * 이 페이지는 **날짜별 주소**(`/news/2026-09-18`)로도 열리지만 **그날치만 남는다.**
 * 실측(2026-09-18): `/news/2026-09-17` → **404**, `/news` 목록도 **404**.
 * 반면 `/news/latest` 는 **그날치와 바이트 단위로 동일한 별칭**이라 매일 알아서 최신이 된다.
 * 날짜를 박은 링크를 배포하면 **바로 다음 날 404 를 띄운다.**
 *
 * ## 왜 같은 도메인인데 절대주소인가
 * 이 파일은 앱(Next.js)이 만드는 화면이 아니라 **VPS 의 Caddy 가 내려주는 정적 HTML**이다
 * (Next.js 라우트가 아니라 `app/` 어디에도 없다). 앱 배포와 수명이 다르므로 앱 내부 링크가
 * 아니라 바깥 링크로 취급한다 — 그래서 `target="_blank"` 로 연다.
 *
 * ## 앱 안에 끼워 넣지 못한다
 * 응답 헤더가 `X-Frame-Options: DENY` 라 iframe 임베드가 **브라우저 차원에서 막힌다.**
 * 미리보기·모달을 시도해도 빈 화면만 나온다. 새 탭이 유일한 방법이다.
 */
export const POLICY_NEWS_URL = "https://salesptlog.online/news/latest";

/**
 * 정책자금 데일리를 앱 화면 안(iframe)에 띄울지 — 지금은 **false**.
 *
 * 위 주석대로 응답 헤더가 `X-Frame-Options: DENY` 라 iframe 이 브라우저 차원에서 막힌다
 * (2026-09-23 재실측: 앱 루트·`/news/*` 둘 다 DENY). 켜두면 **빈 화면만 나와 고장으로 보인다.**
 * 그래서 `/payment/news` 는 이 값이 false 인 동안 iframe 을 아예 렌더하지 않고
 * 「새 창에서 열기」 안내만 보여준다.
 *
 * ## 언제 true 로 올리나
 * VPS Caddy 에서 **`/news/*` 경로만** `SAMEORIGIN` 으로 바꾼 뒤(앱 본체는 DENY 유지 —
 * 클릭재킹 방어를 넓히지 않는다), 이 한 줄만 true 로 올리는 별도 PR 을 낸다.
 * 뉴스와 앱은 같은 도메인(salesptlog.online)이라 SAMEORIGIN 이면 임베드가 성립한다.
 */
export const POLICY_NEWS_EMBED = false;

/**
 * 주간 목표 회의록 — 내부 기록 권한 사용자가 14열 복사 후 붙여넣는 canonical Notion 페이지.
 * 화면 안에 별도 미리보기를 복제하지 않고 이 정본을 새 탭으로 연다.
 */
export const WEEKLY_GOALS_MEETING_URL =
  "https://app.notion.com/p/3083fa7fca00806fae60ea8eae34511e";
