/**
 * Layer: repo — 정책자금뉴스 공고 피드 읽기(2026-10-26 맞춤공고 2단계).
 * VPS Caddy 가 공개로 내리는 /news/data/index.json → 최근 날짜별 JSON. 쓰기 없음.
 * 30분 캐시(VPS 갱신 주기와 같음). 실패한 날은 건너뛰고, 목록을 못 받으면 빈 배열 — 공고가 없을 뿐 화면은 산다.
 */
import { POLICY_NEWS_DATA_URL } from "@/config/links";
import { PolicyNewsDay, PolicyNewsIndex } from "@/types/policy-news";

const REVALIDATE = 1800;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`policy-news ${res.status} ${url}`);
  return res.json();
}

/** 최근 `days` 개 게시일(평일)의 공고 — 날짜 내림차순. */
export async function readPolicyNewsDays(days = 14): Promise<PolicyNewsDay[]> {
  let dates: string[];
  try {
    dates = PolicyNewsIndex.parse(await getJson(`${POLICY_NEWS_DATA_URL}/index.json`)).dates.slice(0, days);
  } catch (e) {
    console.warn("[policy-news] index 읽기 실패", e instanceof Error ? e.message : e);
    return [];
  }
  const out = await Promise.all(
    dates.map(async (d) => {
      try {
        return PolicyNewsDay.parse(await getJson(`${POLICY_NEWS_DATA_URL}/${d}.json`));
      } catch (e) {
        console.warn("[policy-news] 날짜 읽기 실패", d, e instanceof Error ? e.message : e);
        return null;
      }
    }),
  );
  return out.filter((d): d is PolicyNewsDay => d !== null);
}
