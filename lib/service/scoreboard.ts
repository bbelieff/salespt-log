/**
 * Layer: service — 아레나 전광판 집계 (admin 전용, §6).
 *
 * 기수별(A1-N) 평균: 생산/유입/컨택/미팅/계약 (주차 1~8 + 총합).
 *  - 모수 = 입금자(registry Q memo "입금" 포함)만. 미입금 제외.
 *  - 부부 = 1시트 = 1명 (spreadsheetId 로 dedup).
 *  - 각 시트 주차별 지표 = 대시보드 C33:H40 (readWeeklyPerformance).
 *  - 35+ 시트 read → unstable_cache(30분) + 동시성 5 + sheets-client 429 retry.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import {
  listArenaParticipants,
  normalizeArenaCohort,
} from "@/repo/users-arena";
import {
  readWeeklyPerformance,
  type WeeklyPerf,
} from "@/repo/dashboard";
import { readAll as readContractPayments } from "@/repo/contract-payment";
import { readShareScores, setShareScores } from "@/repo/share-scores";
import { readCourseStart, weekIndexOf } from "@/repo/sales";
import { parseISO } from "@/util/week";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { splitContractRevenue } from "./dashboard";
import { countTerminatedInWeeks, terminatedByWeek } from "./termination-count";
import type { RankingMetric, RankingEntry } from "@/types";

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

/** 시트 1개 02 계약수납 read(매출용) — 동일 30분 캐시 태그. 매출은 대시보드 셀(승인 포함
 *  가능)이 아니라 splitContractRevenue(수임비+수납액, 이월 제외)로 계산 → KPI 와 동일 정의. */
const cachedContractPayments = unstable_cache(
  async (sheetId: string) => readContractPayments(sheetId),
  ["arena-scoreboard-payments-v1"],
  { revalidate: 1800, tags: [SCOREBOARD_TAG] },
);

/** 시트 1개 O1(수강시작일) read — 이월 경계(매출 분리) 판정용. 동일 30분 캐시 태그.
 *  ⚠️ unstable_cache 는 JSON 직렬화 — Date 를 그대로 캐시하면 히트 시 string 으로 강등돼
 *  weekIndexOf `.getTime()` 이 500 을 던진다(2026-07-29 P0, me.ts 2026-05-13 동일 사고).
 *  경계는 "YYYY-MM-DD" 문자열로만 통과시키고 소비처가 parseISO 로 복원한다. */
const cachedCourseStart = unstable_cache(
  async (sheetId: string) => toISODate(await readCourseStart(sheetId)) || null,
  ["arena-scoreboard-coursestart-v2"], // v2: Date → ISO 문자열 (구 캐시 오염 회피)
  { revalidate: 1800, tags: [SCOREBOARD_TAG] },
);

/** Date → "YYYY-MM-DD" (로컬). 이월 경계 비교용 — service/dashboard.toISODate 와 동일 규칙. */
function toISODate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

    // 해지 계약수 제외: 주차별 계약(C33:H40)에서 해지 계약(계약일 주차)만큼 차감.
    // payments·courseStart 추가 read(계약왕과 동일 캐시 키 → 번들 경로는 캐시 히트, 추가 왕복 ≈0).
    const reads = await pMap(paidIds, async (id) => {
      const [wp, payments, courseStart] = await Promise.all([
        cachedWeekly(id).catch(() => null),
        cachedContractPayments(id).catch(() => []),
        cachedCourseStart(id).catch(() => null),
      ]);
      if (!wp) return null;
      const termWeeks = courseStart
        ? terminatedByWeek(payments, parseISO(courseStart))
        : new Array<number>(STATS_WEEKS).fill(0);
      return { wp, termWeeks };
    });
    const valid = reads.filter(
      (r): r is { wp: WeeklyPerf[]; termWeeks: number[] } => r !== null,
    );
    const n = valid.length;

    const weekly = Array.from({ length: STATS_WEEKS }, (_, w) => {
      const acc = emptyMetrics();
      for (const { wp, termWeeks } of valid) {
        const row = wp[w];
        if (!row) continue;
        for (const m of METRICS) acc[m] += row[m];
        acc.계약 -= termWeeks[w] ?? 0; // 해지 제외(raw 와 동일 주차 버킷)
      }
      acc.계약 = Math.max(0, acc.계약); // 음수 클램프(합계 단위)
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
    for (const { wp, termWeeks } of valid) {
      for (const row of wp) {
        for (const m of METRICS) totalSum[m] += row[m];
      }
      totalSum.계약 -= termWeeks.reduce((a, b) => a + b, 0); // 해지 제외(총합)
    }
    totalSum.계약 = Math.max(0, totalSum.계약);
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

// ── 개인 랭킹 (arena-scoreboard-v2) — 지표별 이름 공개 순위 ──────────
/** value desc·동점 동순위·이름 asc, rank 1부터, 상위 10. (테스트 export) */
export function rankEntries(
  items: { name: string; cohort: string; value: number }[],
): RankingEntry[] {
  const sorted = [...items].sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name, "ko"),
  );
  let rank = 0;
  let prev: number | null = null;
  return sorted.slice(0, 10).map((it, i) => {
    if (prev === null || it.value !== prev) rank = i + 1; // 동점 동순위
    prev = it.value;
    return { name: it.name, cohort: it.cohort, value: it.value, rank };
  });
}

/**
 * 지표별 개인 랭킹. 입금 참가자 1시트=1엔트리(부부는 registry name 그대로).
 * 미팅·계약=8주 합, 매출=수임비+수납액(이월 제외, splitContractRevenue.arena — 승인 제외),
 * 앱사용량=5지표 8주 합(활동량 프록시), 공유왕=share_scores points. read 캐시(30분, SCOREBOARD_TAG).
 */
export async function loadIndividualRankings(): Promise<
  Record<RankingMetric, RankingEntry[]>
> {
  const participants = await listArenaParticipants();
  // paid 시트 dedup — 1시트=1엔트리(부부/멀티계정 1개), 입금자만.
  const bySheet = new Map<string, { name: string; cohort: string; paid: boolean }>();
  for (const u of participants) {
    if (!u.spreadsheetId) continue;
    const cur = bySheet.get(u.spreadsheetId);
    bySheet.set(u.spreadsheetId, {
      name: cur?.name ?? u.name,
      cohort: cur?.cohort ?? normalizeArenaCohort(u.cohort),
      paid: (cur?.paid ?? false) || u.memo.includes("입금"),
    });
  }
  const paid = [...bySheet.entries()].filter(([, v]) => v.paid);

  const perSheet = await pMap(paid, async ([id, info]) => {
    const [wp, payments, courseStart] = await Promise.all([
      cachedWeekly(id).catch(() => null),
      cachedContractPayments(id).catch(() => []),
      cachedCourseStart(id).catch(() => null),
    ]);
    let 미팅 = 0;
    let 계약 = 0;
    let 앱사용량 = 0;
    if (wp) {
      for (const row of wp) {
        미팅 += row.미팅;
        계약 += row.계약;
        // 앱사용량 = 기록 활동량 프록시(5지표 합). 향후 PostHog 등으로 교체 지점.
        앱사용량 += row.생산 + row.유입 + row.컨택 + row.미팅 + row.계약;
      }
    }
    // 해지 계약은 계약 "수"에서 제외(계약일 주차 1~8, plain isTerminated — raw 주차정의와 정합).
    // 매출·앱사용량은 무변(매출은 splitContractRevenue.arena 가 이미 반환액 차감).
    if (courseStart)
      계약 = Math.max(0, 계약 - countTerminatedInWeeks(payments, parseISO(courseStart)));
    // 매출 = 수임비 + 수납액(이월 제외) — 대시보드 KPI 와 동일 정의(splitContractRevenue.arena).
    // 시트 총매출 셀(승인 포함 가능) 의존 제거 → 전광판·KPI 매출 절대 안 어긋남.
    const 매출 = courseStart
      ? splitContractRevenue(payments, courseStart).arena.revenue
      : 0;
    return { name: info.name, cohort: info.cohort, 미팅, 계약, 매출, 앱사용량 };
  });

  const shares = await readShareScores().catch(() => []);
  const pick = (key: "미팅" | "계약" | "매출" | "앱사용량") =>
    rankEntries(
      perSheet.map((p) => ({ name: p.name, cohort: p.cohort, value: p[key] })),
    );
  return {
    미팅: pick("미팅"),
    계약: pick("계약"),
    매출: pick("매출"),
    앱사용량: pick("앱사용량"),
    공유왕: rankEntries(
      shares.map((s) => ({ name: s.name, cohort: s.cohort, value: s.points })),
    ),
  };
}

// ── 전광판 묶음 (기수 평균 + 개인 랭킹 + 시즌 주차) ────────────────────
export interface ScoreboardBundle {
  byCohort: CohortScore[];
  rankings: Record<RankingMetric, RankingEntry[]>;
  seasonWeek: number; // 1~8 (0 = 시작 전/미상)
}

/** 시즌 현재 주차 — 대표 입금 시트 O1(수강시작일) 기준 weekIndexOf, 1~8 캡. */
async function currentSeasonWeek(): Promise<number> {
  const parts = await listArenaParticipants();
  const rep = parts.find(
    (u) => u.spreadsheetId && u.memo.includes("입금"),
  );
  if (!rep?.spreadsheetId) return 0;
  const start = await readCourseStart(rep.spreadsheetId);
  return Math.min(Math.max(weekIndexOf(new Date(), start), 0), STATS_WEEKS);
}

/** 전광판 한 화면용 데이터 — 페이지가 1콜로 받아 props 분배. */
export async function loadScoreboardBundle(): Promise<ScoreboardBundle> {
  const [board, rankings] = await Promise.all([
    loadScoreboard(),
    loadIndividualRankings(),
  ]);
  const seasonWeek = await currentSeasonWeek().catch(() => 0);
  return { byCohort: board.byCohort, rankings, seasonWeek };
}

// ── 공유왕 수동 집계 (admin) — share_scores 대상 목록 + 저장 ────────────
export interface ShareScoreTarget {
  email: string; // 대표 email(저장 키)
  name: string;
  cohort: string;
  points: number; // 현재 점수(없으면 0)
}

/** 입금 참가자(1시트=1엔트리) + 현재 공유왕 점수 머지. admin 집계 UI 모수. */
export async function listShareScoreTargets(): Promise<ShareScoreTarget[]> {
  const participants = await listArenaParticipants();
  const bySheet = new Map<
    string,
    { email: string; name: string; cohort: string; paid: boolean }
  >();
  for (const u of participants) {
    if (!u.spreadsheetId) continue;
    const cur = bySheet.get(u.spreadsheetId);
    bySheet.set(u.spreadsheetId, {
      email: cur?.email ?? u.email,
      name: cur?.name ?? u.name,
      cohort: cur?.cohort ?? normalizeArenaCohort(u.cohort),
      paid: (cur?.paid ?? false) || u.memo.includes("입금"),
    });
  }
  const shares = await readShareScores().catch(() => []);
  const pointsByEmail = new Map(
    shares.map((s) => [s.email.toLowerCase(), s.points]),
  );
  // 공유왕은 운영자 수동 점수라 입금 모수 제한 없이 전체 아레나 참가자(1시트=1명) 노출.
  // (전광판 자동지표 모수=입금자 규칙과 무관 — 운영자가 누구에게나 점수 부여 가능.)
  return [...bySheet.values()]
    .map((v) => ({
      email: v.email,
      name: v.name,
      cohort: v.cohort,
      points: pointsByEmail.get(v.email.toLowerCase()) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.cohort.localeCompare(b.cohort, "en", { numeric: true }) ||
        a.name.localeCompare(b.name, "ko"),
    );
}

/** 공유왕 점수 저장 — {email,points}[] 만 받아 name/cohort 는 참가자에서 보강.
 *  비참가자 email 은 제외. 저장 후 전광판 랭킹 캐시 무효화. */
export async function saveShareScores(
  rows: { email: string; points: number }[],
): Promise<void> {
  if (rows.length === 0) return;
  const targets = await listShareScoreTargets();
  const byEmail = new Map(targets.map((t) => [t.email.toLowerCase(), t]));
  const now = new Date().toISOString();
  const full = rows
    .map((r) => {
      const t = byEmail.get(r.email.toLowerCase());
      return t
        ? {
            email: t.email,
            name: t.name,
            cohort: t.cohort,
            points: Math.round(r.points),
            updatedAt: now,
          }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (full.length === 0) return;
  await setShareScores(full);
  revalidateTag(SCOREBOARD_TAG); // 랭킹 재계산
}
