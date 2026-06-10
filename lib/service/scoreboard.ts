/**
 * Layer: service — 아레나 전광판 집계 (admin 전용, §6).
 *
 * 기수별(A1-N) 평균: 생산/유입/컨택/미팅/계약 (주차 1~8 + 총합).
 *  - 모수 = 입금자(registry Q memo "입금" 포함)만. 미입금 제외.
 *  - 부부 = 1시트 = 1명 (spreadsheetId 로 dedup).
 *  - 각 시트 주차별 지표 = 대시보드 C33:H40 (readWeeklyPerformance).
 *  - 35+ 시트 read → unstable_cache(30분) + 동시성 5 + sheets-client 429 retry.
 */
import { unstable_cache } from "next/cache";
import {
  listArenaParticipants,
  normalizeArenaCohort,
} from "@/repo/users-arena";
import { readWeeklyPerformance, type WeeklyPerf } from "@/repo/dashboard";

export const METRICS = ["생산", "유입", "컨택", "미팅", "계약"] as const;
export type ScoreMetric = (typeof METRICS)[number];
export type MetricRow = Record<ScoreMetric, number>;

export const SCOREBOARD_TAG = "arena-scoreboard";

/** 시트 1개 주차별 read — 30분 캐시. 수동 새로고침 = revalidateTag(SCOREBOARD_TAG). */
const cachedWeekly = unstable_cache(
  async (sheetId: string) => readWeeklyPerformance(sheetId),
  ["arena-scoreboard-weekly-v1"],
  { revalidate: 1800, tags: [SCOREBOARD_TAG] },
);

/** 동시성 제한 map (Sheets quota 보호, me.ts pMapBundle 동일 패턴). */
async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export interface CohortScore {
  cohort: string; // 정규화 "A1-1"
  paidMembers: number; // 입금자(=모수) 수, read 성공 기준
  weekly: Array<{ week: number } & MetricRow>; // 주차별 평균
  total: MetricRow; // 8주 합계의 평균 (멤버당 누적 → 기수 평균)
}
export interface ScoreboardData {
  byCohort: CohortScore[];
}

const emptyMetrics = (): MetricRow => ({
  생산: 0,
  유입: 0,
  컨택: 0,
  미팅: 0,
  계약: 0,
});
const round1 = (x: number) => Math.round(x * 10) / 10;
const avg = (sum: number, n: number) => (n > 0 ? round1(sum / n) : 0);

export async function loadScoreboard(): Promise<ScoreboardData> {
  const participants = await listArenaParticipants();

  // cohort → (spreadsheetId → 입금여부). 부부/멀티계정은 같은 sheetId 로 1개.
  const byCohort = new Map<string, Map<string, boolean>>();
  for (const u of participants) {
    if (!u.spreadsheetId) continue;
    const c = normalizeArenaCohort(u.cohort);
    let sheets = byCohort.get(c);
    if (!sheets) {
      sheets = new Map();
      byCohort.set(c, sheets);
    }
    const paid = (sheets.get(u.spreadsheetId) ?? false) || u.memo.includes("입금");
    sheets.set(u.spreadsheetId, paid);
  }

  const cohorts = [...byCohort.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );

  const byCohortResult: CohortScore[] = [];
  for (const c of cohorts) {
    const sheets = byCohort.get(c)!;
    const paidIds = [...sheets.entries()]
      .filter(([, paid]) => paid)
      .map(([id]) => id);

    const reads = await pMap(paidIds, (id) =>
      cachedWeekly(id).catch(() => null),
    );
    const valid = reads.filter((r): r is WeeklyPerf[] => r !== null);
    const n = valid.length;

    const weekly = Array.from({ length: 8 }, (_, w) => {
      const acc = emptyMetrics();
      for (const wp of valid) {
        const row = wp[w];
        if (!row) continue;
        for (const m of METRICS) acc[m] += row[m];
      }
      return {
        week: w + 1,
        생산: avg(acc.생산, n),
        유입: avg(acc.유입, n),
        컨택: avg(acc.컨택, n),
        미팅: avg(acc.미팅, n),
        계약: avg(acc.계약, n),
      };
    });

    const totalSum = emptyMetrics();
    for (const wp of valid) {
      for (const row of wp) {
        for (const m of METRICS) totalSum[m] += row[m];
      }
    }
    const total: MetricRow = {
      생산: avg(totalSum.생산, n),
      유입: avg(totalSum.유입, n),
      컨택: avg(totalSum.컨택, n),
      미팅: avg(totalSum.미팅, n),
      계약: avg(totalSum.계약, n),
    };

    byCohortResult.push({ cohort: c, paidMembers: n, weekly, total });
  }

  return { byCohort: byCohortResult };
}
