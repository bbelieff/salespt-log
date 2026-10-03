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
 * `/news/latest`는 날짜를 박지 않아 매일 최신 원문을 가리킨다. 이 페이지는 Next.js
 * route가 아니라 VPS Caddy가 같은 origin에서 내리는 공개 정적 HTML이다.
 *
 * 2026-10-03 live probe: 응답은 200이고 X-Frame-Options가 없으며 CSP는 same-origin
 * frame parent를 허용한다. 원문 script와 `_blank` 링크 기능은 iframe에서 실행하되,
 * child는 `allow-same-origin` 없는 opaque origin으로 격리한다.
 */
export const POLICY_NEWS_ORIGIN = "https://salesptlog.online";
export const POLICY_NEWS_URL = "https://salesptlog.online/news/latest";

/**
 * 주간 목표 회의록 — 내부 기록 권한 사용자가 14열 복사 후 붙여넣는 canonical Notion 페이지.
 * 화면 안에 별도 미리보기를 복제하지 않고 이 정본을 새 탭으로 연다.
 */
export const WEEKLY_GOALS_MEETING_URL =
  "https://app.notion.com/p/3083fa7fca00806fae60ea8eae34511e";
