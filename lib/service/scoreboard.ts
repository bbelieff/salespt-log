/**
 * Layer: service — 아레나 전광판 집계 (admin 전용, §6).
 *
 * 기수별(A1-N) 평균: 생산/유입/컨택/미팅/계약 (주차 1~8 + 총합).
 *  - 모수 = 입금자(registry Q memo "입금" 포함)만. 미입금 제외.
 *  - 부부 = 1시트 = 1명 (spreadsheetId 로 dedup).
 *  - 각 시트 주차별 지표(원래 대시보드 C33:H40 시트 read) + 02 계약수납·O1 은
 *    `scoreboard-db.ts::loadWeeklyBundles` 가 묶어서 공급 — DB 파일럿(아레나 전원)은 배치 DB
 *    read, 그 외는 기존 시트 경로(BBE-63, R7 Phase 3 #14 · 500줄 캡 분리).
 */
import { revalidateTag } from "next/cache";
import {
  listArenaParticipants,
  normalizeArenaCohort,
} from "@/repo/users-arena";
import { listCohorts } from "@/repo/cohorts";
import { readShareScores, setShareScores } from "@/repo/share-scores";
import { parseISO, todayKST } from "@/util/week";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { splitContractRevenue } from "./dashboard";
import { arenaCohortLabelParts } from "./cohort-token";
import {
  currentSeasonStartISO,
  isInSeason,
  resolveCurrentSeason,
  seasonWeekOf,
} from "./arena-season-config";
import { countTerminatedInWeeks, terminatedByWeek } from "./termination-count";
import { SCOREBOARD_TAG, loadWeeklyBundles } from "./scoreboard-db";
import type { RankingMetric, RankingEntry, User } from "@/types";

export const METRICS = ["생산", "유입", "컨택", "미팅", "계약"] as const;
export type ScoreMetric = (typeof METRICS)[number];
export type MetricRow = Record<ScoreMetric, number>;

export { SCOREBOARD_TAG };

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

/**
 * 전광판 모수 = **현재 시즌 참가자만** + 그 시즌 번호 (AR-2b SSOT).
 * 옛 시즌(A1) 행은 registry 에 그대로 남는다(아레나→아레나 이월 경로가 archived 마킹을
 * 안 함) → 스코프를 안 걸면 시즌2 헤더 아래 A1 기수·멤버가 그대로 나열된다(적대리뷰 HIGH).
 * registry read 는 캐시되므로 호출이 늘어도 추가 왕복 없음.
 */
async function currentSeasonScope(): Promise<{
  parts: User[];
  season: number;
  /** 현재 시즌 개강일(cohorts J). 주차 앵커 — 참가자 시트 O1 은 쓰지 않는다. */
  startISO: string;
}> {
  const [all, cohorts] = await Promise.all([
    listArenaParticipants(),
    listCohorts().catch(() => []), // 시즌 config 읽기 실패 → 0(미상) → 스코프 미적용
  ]);
  // 시즌 정본 = cohorts 탭 J열(admin 입력). 참가자별 registry K/시트 O1 은 템플릿 오염 때문에 안 쓴다.
  // 개막 경계는 **KST 기준 오늘** — 서버 로컬(UTC)로 재면 개막일 09:00 KST 까지 전날로 읽힌다.
  const today = todayKST();
  const season = resolveCurrentSeason(cohorts, today);
  return {
    parts: all.filter((u) => isInSeason(u.cohort, season)),
    season,
    startISO: currentSeasonStartISO(cohorts, today),
  };
}

export async function loadScoreboard(): Promise<ScoreboardData> {
  const { parts: participants } = await currentSeasonScope();

  // cohort → (spreadsheetId → 입금여부). 부부/멀티계정은 같은 sheetId 로 1개.
  const byCohort = new Map<string, Map<string, boolean>>();
  // sheetId → cohort — loadWeeklyBundles 의 DB 파일럿 판정용(1시트=1cohort 전제, 부부도 동일 기수).
  const cohortOfSheet = new Map<string, string>();
  for (const u of participants) {
    if (!u.spreadsheetId) continue;
    const c = normalizeArenaCohort(u.cohort);
    cohortOfSheet.set(u.spreadsheetId, u.cohort);
    let sheets = byCohort.get(c);
    if (!sheets) {
      sheets = new Map();
      byCohort.set(c, sheets);
    }
    const paid = (sheets.get(u.spreadsheetId) ?? false) || u.memo.includes("입금");
    sheets.set(u.spreadsheetId, paid);
  }
  // 입금 확정 후(OR 누적 완료) 전체 입금자 시트 집합을 한 번에 뽑는다 — 기수별 반복 대신
  // 배치 1회로 로드(BBE-63 목적).
  const paidIdSet = new Set<string>();
  for (const sheets of byCohort.values()) {
    for (const [id, paid] of sheets) if (paid) paidIdSet.add(id);
  }

  const cohorts = [...byCohort.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );

  // 전체 입금자 시트를 한 번에 배치 로드(BBE-63) — 기수별로 쪼개 반복하면 DB 배치 이점이 준다.
  const bundles = await loadWeeklyBundles(
    [...paidIdSet].map((id) => ({ id, cohort: cohortOfSheet.get(id) ?? "" })),
  );

  const byCohortResult: CohortScore[] = [];
  for (const c of cohorts) {
    const sheets = byCohort.get(c)!;
    const paidIds = [...sheets.entries()]
      .filter(([, paid]) => paid)
      .map(([id]) => id);

    // 해지 계약수 제외: 주차별 계약(C33:H40)에서 해지 계약(계약일 주차)만큼 차감.
    const valid = paidIds.flatMap((id) => {
      const b = bundles.get(id);
      if (!b) return [];
      const termWeeks = b.courseStartISO
        ? terminatedByWeek(b.payments, parseISO(b.courseStartISO))
        : new Array<number>(STATS_WEEKS).fill(0);
      return [{ wp: b.wp, termWeeks }];
    });
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
  const { parts: participants, season } = await currentSeasonScope();
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

  const bundles = await loadWeeklyBundles(
    paid.map(([id, info]) => ({ id, cohort: info.cohort })),
  );
  const perSheet = paid.map(([id, info]) => {
    const b = bundles.get(id);
    const wp = b?.wp ?? null;
    const payments = b?.payments ?? [];
    const courseStart = b?.courseStartISO ?? null;
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

  // 공유왕 포디움도 같은 시즌 스코프 — 옛 시즌 멤버가 공개 화면에 남지 않게.
  // (saveShareScores 가 normalizeArenaCohort 로 저장 → '기' 유무 무관 매칭.)
  // admin 집계 로스터(listShareScoreTargets)는 과거 시즌도 보이는 게 유용하므로 그대로 둔다.
  const shares = (await readShareScores().catch(() => [])).filter((s) =>
    isInSeason(s.cohort, season),
  );
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
  season: number; // 현재 시즌 번호 (0 = 미상). SSOT=resolveCurrentSeason (AR-2b)
}

/** 전광판 한 화면용 데이터 — 페이지가 1콜로 받아 props 분배.
 *  라벨(season)·주차·표·랭킹이 **같은 스코프**에서 나오도록 시즌을 먼저 정한다. */
export async function loadScoreboardBundle(): Promise<ScoreboardBundle> {
  const scope = await currentSeasonScope().catch(() => null);
  const [board, rankings] = await Promise.all([
    loadScoreboard(),
    loadIndividualRankings(),
  ]);
  // 주차 = **시즌 개강일**(cohorts J) 앵커. 개강일 미상이면 0 → 헤더가 주차 칸을 생략한다.
  const seasonWeek = scope ? seasonWeekOf(scope.startISO, todayKST()) : 0;
  return {
    byCohort: board.byCohort,
    rankings,
    seasonWeek,
    season: scope?.season ?? 0, // 미상이면 헤더가 "아레나"로 degrade
  };
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
