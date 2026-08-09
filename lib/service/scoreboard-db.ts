/**
 * Layer: service — 전광판(scoreboard.ts) 주차별 5지표 DB 집계 (BBE-63, R7 Phase 3 #14).
 *
 * scoreboard.ts 에서 분리(500줄 캡, index.ts 500줄 분리와 동일 관례) — 시트 3회 read
 * (cachedWeekly·cachedContractPayments·cachedCourseStart) 중 앞 2개를 DB 파일럿(아레나 전원)
 * 한정 배치 DB read 로 대체한다. courseStart(O1)는 DB 대응값이 없어 시트 read 를 양쪽 경로
 * 공용으로 유지(캐시됨, 절약 대상 아님 — BBE-63 목표는 나머지 2개 제거).
 */
import { unstable_cache } from "next/cache";
import { readWeeklyPerformance, type WeeklyPerf } from "@/repo/dashboard";
import { readAll as readContractPayments } from "@/repo/contract-payment";
import { readCourseStart, weekIndexOf } from "@/repo/sales";
import { parseISO } from "@/util/week";
import { STATS_WEEKS } from "@/config/cohort-dates";
import { isDbReadPilot } from "./daily-source";
import { dbEnabled, type DbSalesRow } from "@/repo/db/client";
import {
  readScoreboardRowsFromDbBatch,
  type ScoreboardRawRows,
} from "@/repo/db/scoreboard-stats";
import type { ContractPayment, Meeting } from "@/types";

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

// 이월 미팅(구분="이월") 제외 — weeklyActivityFromDb(dashboard-aggregates.ts)와 동일 술어를
// 로컬 재정의(그 파일은 작업원C·BBE-66 점유 — export 추가 대신 여기서 독립 보유, 2줄뿐이라 중복
// 비용 낮음).
//
// ✅ **미팅 = 미팅완료(01!L)** — 구 세션이 "미확정(예약 H 일 수도)"으로 남긴 건을 확정했다
// (2026-08-09). 근거 3개가 같은 답을 가리킨다:
//  ① 수식 실측 — setup-formulas.ts:139 이 설치하는 01!L =
//     COUNTIFS(04!D,<그날>,04!J,"계약",04!AO,"<>이월") + COUNTIFS(...,"완료",...).
//     즉 상태∈{완료,계약} ∧ 이월제외 ∧ **미팅날짜(D) 키**. 계약(01!N, :141)도 같은 꼴.
//  ② 구조 반증 — "미팅예약"은 시트에서 01!R4:U5·F4 펀넬로만 존재하고 그 수식은
//     COUNTIFS(04!F,04!J) 로 **날짜 무필터 누적**이다(setup-formulas.ts:151·157,
//     dashboard-aggregates.ts 주석 동일). 날짜가 안 걸린 셀에서는 주차별 값이 나올 수
//     없다 → 주차 블록의 미팅 컬럼이 예약일 가능성은 구조적으로 배제된다.
//  ③ 라이브 대조 — 같은 블록(C33:H40)의 H(활동량)=생산×1+컨택×1.5+**미팅×2** 를
//     이 정의 그대로 재현한 weeklyActivityFromDb 가 dashboard-parity run 31267667665
//     에서 8·9기 12명 **전원 diff 0**. 생산·컨택이 같은 소스이므로 미팅 항도 일치한다.
// → scripts/ops/scoreboard-parity.mjs 라이브 실행은 여전히 권장(전 기수 확인)이지만,
//   이 정의 자체는 더 이상 미확정이 아니다. 수식이 바뀌면 아래 가드 테스트가 깨진다
//   (tests/service/scoreboard-db.test.ts "01!L·N 수식 결속").
const isDone = (상태: Meeting["상태"]): boolean => 상태 === "완료" || 상태 === "계약";
const isCarryover = (mt: Meeting): boolean => mt.구분 === "이월";

/**
 * 주차별 5지표(생산/유입/컨택/미팅/계약) — 대시보드 C33:H40(readWeeklyPerformance) DB 재현.
 *
 *  · 생산/유입/컨택 = salesRows 의 production/inflow/contactProgress 주차합(채널 무관, 01!E~G
 *    직접입력값의 주차 블록 합 — channelStackingFromDb 와 동일 소스, 무기간클램프·전채널합산).
 *  · 미팅 = 미팅완료(상태∈{완료,계약})·이월제외, 미팅날짜 주차 카운트(01!L 열 주차합).
 *  · 계약 = 상태="계약"(계약여부 아님, 실측 setup-formulas.ts N열 수식)·이월제외, 미팅날짜
 *    주차 카운트. **dashboard-aggregates.ts 의 weeklyContractsFromDb 는 이 이월 제외가
 *    빠져있어(profile-stats-db.ts 가 이미 지적) 재사용하지 않고 여기서 새로 계산한다.**
 *
 * 순수함수 — 테스트 대상. courseStart 는 참가자 개인 O1(시트, DB 대응값 없음 — 호출부가 별도 read).
 */
export function weeklyPerfFromDb(
  salesRows: DbSalesRow[],
  meetings: Meeting[],
  courseStart: Date,
): WeeklyPerf[] {
  const weeks: WeeklyPerf[] = Array.from({ length: STATS_WEEKS }, (_, w) => ({
    week: w + 1,
    생산: 0,
    유입: 0,
    컨택: 0,
    미팅: 0,
    계약: 0,
  }));
  for (const r of salesRows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const w = weekIndexOf(parseISO(r.date), courseStart);
    if (w < 1 || w > STATS_WEEKS) continue;
    const row = weeks[w - 1]!;
    row.생산 += r.production;
    row.유입 += r.inflow;
    row.컨택 += r.contactProgress;
  }
  for (const m of meetings) {
    if (isCarryover(m)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.미팅날짜)) continue;
    const w = weekIndexOf(parseISO(m.미팅날짜), courseStart);
    if (w < 1 || w > STATS_WEEKS) continue;
    const row = weeks[w - 1]!;
    if (isDone(m.상태)) row.미팅 += 1;
    if (m.상태 === "계약") row.계약 += 1;
  }
  return weeks;
}

export interface WeeklyBundle {
  wp: WeeklyPerf[];
  payments: ContractPayment[];
  courseStartISO: string | null;
}

/**
 * N개 시트의 (주차별 5지표·02 계약·O1) 묶음 — DB 파일럿(아레나 전원)은 배치 DB read, 그 외·
 * DB 실패는 기존 시트 캐시 경로로 폴백. courseStart(O1)는 DB 대응값이 없어 양쪽 공통으로
 * cachedCourseStart(시트, 30분 캐시)를 먼저 읽는다 — 이 한 번의 read 는 폴백 여부와 무관하게
 * 필요하므로 절약 대상이 아니다(BBE-63 최적화 목표 = cachedWeekly·cachedContractPayments 제거).
 */
export async function loadWeeklyBundles(
  entries: { id: string; cohort: string }[],
): Promise<Map<string, WeeklyBundle>> {
  const out = new Map<string, WeeklyBundle>();
  if (entries.length === 0) return out;

  const courseStartPairs = await pMap(
    entries,
    async (e): Promise<[string, string | null]> => [e.id, await cachedCourseStart(e.id).catch(() => null)],
  );
  const courseStartById = new Map(courseStartPairs);

  const dbOn = dbEnabled();
  const dbCandidates = entries.filter(
    (e) => dbOn && isDbReadPilot(e.cohort) && courseStartById.get(e.id),
  );
  const dbCandidateIds = new Set(dbCandidates.map((e) => e.id));
  let dbRowsById: Map<string, ScoreboardRawRows> | null = null;
  if (dbCandidates.length > 0) {
    dbRowsById = await readScoreboardRowsFromDbBatch(dbCandidates.map((e) => e.id)).catch(
      () => null, // 배치 전체 실패 → 아래에서 이 그룹도 시트 폴백으로 합류
    );
  }

  if (dbRowsById) {
    for (const e of dbCandidates) {
      const csISO = courseStartById.get(e.id)!;
      const rows = dbRowsById.get(e.id) ?? { salesRows: [], meetings: [], contracts: [] };
      out.set(e.id, {
        wp: weeklyPerfFromDb(rows.salesRows, rows.meetings, parseISO(csISO)),
        payments: rows.contracts,
        courseStartISO: csISO,
      });
    }
  }

  // 시트 경로 — DB 배치가 통째로 실패했으면 dbCandidates 포함 전원, 아니면 DB 대상이 아니었던 나머지.
  const sheetTargets = dbRowsById ? entries.filter((e) => !dbCandidateIds.has(e.id)) : entries;
  await pMap(sheetTargets, async (e) => {
    const [wp, payments] = await Promise.all([
      cachedWeekly(e.id).catch(() => null),
      cachedContractPayments(e.id).catch(() => []),
    ]);
    if (wp) out.set(e.id, { wp, payments, courseStartISO: courseStartById.get(e.id) ?? null });
  });

  return out;
}
