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
 * 2026-10-02 live probe: `news/latest` 는 200, 로그인·리다이렉트 없음,
 * 앱 안에서는 이 공개 주소의 고정 JSON payload만 서버에서 읽고 허용 필드를 React로 그린다.
 * 원문 HTML/script 실행, 쿠키 중계, 임의 URL 프록시는 쓰지 않는다.
 */
export const POLICY_NEWS_ORIGIN = "https://salesptlog.online";
export const POLICY_NEWS_URL = "https://salesptlog.online/news/latest";
export const POLICY_NEWS_FETCH_TIMEOUT_MS = 8_000;

export type PolicyNewsItem = {
  id: string;
  status: string;
  name: string;
  agency: string;
  region: string;
  category: string;
  amount: string;
  announcedAt: string;
  deadline: string;
  target: string;
  industryRestriction: string;
  historyRestriction: string;
  specificTarget: string;
  loanType: string;
  repayment: string;
  interest: string;
  fees: string;
  application: string;
  noticeUrl: string | null;
  downloadUrl: string | null;
  newsUrl: string | null;
};

export type PolicyNewsData = {
  date: string;
  total: number;
  items: PolicyNewsItem[];
};

export type PolicyNewsLoadResult =
  | { status: "ready"; data: PolicyNewsData }
  | { status: "error"; message: string };

const POLICY_NEWS_DATA_MARKER = "const DATA = /*__DATA__*/";
const POLICY_NEWS_MAX_ITEMS = 250;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function policyNewsText(value: unknown, max = 2_000): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function safePolicyNewsExternalUrl(value: unknown): string | null {
  const candidate = policyNewsText(value, 2_048);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** 고정 marker 뒤의 JSON 객체 하나만 추출한다. source HTML/script는 실행하지 않는다. */
export function extractEmbeddedPolicyNewsData(html: string): unknown {
  const markerAt = html.indexOf(POLICY_NEWS_DATA_MARKER);
  if (markerAt < 0 || markerAt !== html.lastIndexOf(POLICY_NEWS_DATA_MARKER)) {
    throw new Error("정책자금 데이터 표식을 확인할 수 없습니다.");
  }

  let cursor = markerAt + POLICY_NEWS_DATA_MARKER.length;
  while (/\s/.test(html[cursor] ?? "")) cursor += 1;
  if (html[cursor] !== "{") throw new Error("정책자금 데이터 형식이 올바르지 않습니다.");

  const start = cursor;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; cursor < html.length; cursor += 1) {
    const char = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      return JSON.parse(html.slice(start, cursor + 1));
    }
  }
  throw new Error("정책자금 데이터가 끝나지 않았습니다.");
}

function normalizePolicyNewsItem(raw: unknown, index: number): PolicyNewsItem {
  if (!isObject(raw)) throw new Error("정책자금 항목 형식이 올바르지 않습니다.");
  const name = policyNewsText(raw["사업명"], 300);
  if (!name) throw new Error("정책자금 항목에 사업명이 없습니다.");
  return {
    id: `${index}-${name}`,
    status: policyNewsText(raw["확인상태"], 80),
    name,
    agency: policyNewsText(raw["주관기관"], 200),
    region: policyNewsText(raw["지역"], 100),
    category: policyNewsText(raw["성격"], 80) || "기타",
    amount: policyNewsText(raw["최대지원금액"], 200),
    announcedAt: policyNewsText(raw["공고일"], 40),
    deadline: policyNewsText(raw["마감일"], 80),
    target: policyNewsText(raw["지원대상"]),
    industryRestriction: policyNewsText(raw["업종제한"]),
    historyRestriction: policyNewsText(raw["창업업력제한"]),
    specificTarget: policyNewsText(raw["특정타겟"]),
    loanType: policyNewsText(raw["대출종류"], 200),
    repayment: policyNewsText(raw["상환조건"]),
    interest: policyNewsText(raw["대출금리"], 200),
    fees: policyNewsText(raw["기타조건(보증료 등)"]),
    application: policyNewsText(raw["신청방법"]),
    noticeUrl: safePolicyNewsExternalUrl(raw["공고원문링크"]),
    downloadUrl: safePolicyNewsExternalUrl(raw["다운로드링크"]),
    newsUrl: safePolicyNewsExternalUrl(raw["뉴스·보도링크"]),
  };
}

export function normalizePolicyNewsData(raw: unknown): PolicyNewsData {
  if (!isObject(raw) || !isObject(raw.meta) || !Array.isArray(raw.items) || raw.items.length > POLICY_NEWS_MAX_ITEMS) {
    throw new Error("정책자금 데이터 구조가 올바르지 않습니다.");
  }
  const date = policyNewsText(raw.meta["기준일"], 10);
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(date)) {
    throw new Error("정책자금 기준일 형식이 올바르지 않습니다.");
  }
  const items = raw.items.map(normalizePolicyNewsItem);
  return { date, total: items.length, items };
}

/** 서버 컴포넌트에서만 호출한다. 고정 공개 URL 외의 입력은 받지 않는다. */
export async function loadPolicyNews(fetcher: typeof fetch = fetch): Promise<PolicyNewsLoadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLICY_NEWS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(POLICY_NEWS_URL, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "text/html" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("text/html")) {
      throw new Error("원문 응답을 확인할 수 없습니다.");
    }
    const html = await response.text();
    return { status: "ready", data: normalizePolicyNewsData(extractEmbeddedPolicyNewsData(html)) };
  } catch {
    return { status: "error", message: "잠시 뒤 다시 시도하거나 원문을 새 창에서 확인해 주세요." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 주간 목표 회의록 — 내부 기록 권한 사용자가 14열 복사 후 붙여넣는 canonical Notion 페이지.
 * 화면 안에 별도 미리보기를 복제하지 않고 이 정본을 새 탭으로 연다.
 */
export const WEEKLY_GOALS_MEETING_URL =
  "https://app.notion.com/p/3083fa7fca00806fae60ea8eae34511e";
