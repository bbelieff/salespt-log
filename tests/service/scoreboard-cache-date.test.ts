/**
 * P0 2026-07-29 회귀 가드 — 전광판 캐시 직렬화 (scoreboard-cache-date).
 *
 * unstable_cache 는 결과를 JSON 직렬화한다 → Date 를 캐시에 넣으면 **히트 시 string 으로
 * 강등**돼 weekIndexOf `.getTime()` 이 TypeError → /admin/arena/scoreboard SSR 500
 * (Digest 4057402273). 여기선 unstable_cache 를 JSON 왕복으로 목킹해 라이브 캐시 히트를
 * 모사하고, 해지 계약 1건(= throw 경로 활성 조건)을 넣어 번들이 죽지 않는지 고정한다.
 * me.ts 2026-05-13 동일 사고 — 캐시 경계는 primitive 만 통과시킨다.
 */
import { describe, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";

// 라이브 unstable_cache 의 캐시 히트 = JSON 왕복(Date → string 강등)을 모사.
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...a: unknown[]) => Promise<unknown>) =>
    async (...a: unknown[]) =>
      JSON.parse(JSON.stringify(await fn(...a))),
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

vi.mock("@/repo/users-arena", () => ({
  listArenaParticipants: async () => [
    {
      email: "a@example.com",
      name: "가나다",
      cohort: "A1-1기",
      memo: "입금",
      spreadsheetId: "sheet-1",
    },
  ],
  normalizeArenaCohort: (c: string) => c.replace(/기$/, ""),
}));

vi.mock("@/repo/dashboard", () => ({
  readWeeklyPerformance: async () =>
    Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      생산: 1,
      유입: 1,
      컨택: 1,
      미팅: 1,
      계약: 1,
    })),
}));

// 해지 계약 1건 (해지일 존재 + 유효 계약일 = terminatedByWeek 가 weekIndexOf 에 도달).
const terminated = {
  구분: "",
  계약일: "2026-06-15", // 시작일 +3일 → 1주차
  해지일: "2026-06-20",
  수임비: 100,
  반환액: 0,
  수납1: { 수납액: 0 },
  수납2: { 수납액: 0 },
  수납3: { 수납액: 0 },
} as unknown as ContractPayment;

vi.mock("@/repo/contract-payment", () => ({
  readAll: async () => [terminated],
}));

// readCourseStart 만 Date 고정 — 주차 유틸은 실제 SSOT(@/util/week) 재사용(googleapis 회피).
vi.mock("@/repo/sales", async () => {
  const week = await import("@/util/week");
  return {
    readCourseStart: async () => new Date(2026, 5, 12),
    weekIndexOf: week.weekIndexOf,
    weekStartOf: week.weekStartOf,
    diffDays: week.diffDays,
  };
});

vi.mock("@/repo/share-scores", () => ({
  readShareScores: async () => [],
  setShareScores: async () => {},
  SHARE_SCORES_TAG: "share-scores",
}));

describe("scoreboard 캐시 직렬화 회귀 (P0 2026-07-29)", () => {
  it("캐시 히트(Date→string 강등) + 해지 계약 존재에서 번들이 성공하고 차감이 맞는다", async () => {
    const { loadScoreboardBundle } = await import("@/service/scoreboard");
    const b = await loadScoreboardBundle(); // 수리 전: earlier.getTime is not a function

    expect(b.byCohort).toHaveLength(1);
    const c = b.byCohort[0]!;
    expect(c.paidMembers).toBe(1);
    expect(c.weekly[0]!.계약).toBe(0); // 1주차 계약 1 − 해지 1
    expect(c.total.계약).toBe(7); // 8주 합 8 − 해지 1
    expect(c.total.미팅).toBe(8);

    expect(b.rankings.계약[0]!.value).toBe(7); // countTerminatedInWeeks 경로
    expect(b.rankings.매출[0]!.value).toBe(100); // splitContractRevenue — ISO 문자열 경계
    expect(b.seasonWeek).toBeGreaterThanOrEqual(0);
    expect(b.seasonWeek).toBeLessThanOrEqual(8);
    // 단독 ~8s / 전체 스위트 병렬 부하에서 ~33s 실측(dashboard 모듈 그래프 로딩) — 여유 60s.
  }, 60000);
});
