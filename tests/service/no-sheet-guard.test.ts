/**
 * [no-sheet] 가드 회귀 테스트 (P1, 2026-07-28) — 시트 없는 계정(트레이너 행 등)의
 * 읽기 서비스가 빈 spreadsheetId 로 구글 API 를 부르는 대신 명시 에러를 던지는지.
 * 사고: admin 이 트레이너 행 임퍼스네이션 → 읽기 라우트 전면 500(구글 HTML 에러)·빈 화면.
 * mock 은 users 만 — 가드가 최전방(사용자 해석 직후)이라 다른 의존은 도달 전 차단이 정상.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/repo/users", () => ({
  findUserByEmail: vi.fn(async () => ({
    email: "trainer@x.com",
    cohort: "T",
    name: "김믿음",
    spreadsheetId: "", // 트레이너 행 — 개인 시트 없음
    status: "trainer",
  })),
}));

/** rejects.toThrow 가 이 모듈 그래프에서 hang(원인 미상·실측) → try/catch 소비 형태로 검증. */
async function rejectionOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "(resolved — throw 없음)";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe("[no-sheet] 읽기 서비스 가드", () => {
  // dashboard 모듈 그래프(Sentry·analytics)가 여는 핸들 때문에 정리까지 5s 초과 — 여유 타임아웃(실측).
  it("loadDashboard: 빈 spreadsheetId → [no-sheet] throw", async () => {
    const { loadDashboard } = await import("@/service/dashboard");
    expect(await rejectionOf(loadDashboard("trainer@x.com"))).toMatch(/^\[no-sheet\]/);
  }, 15000);

  it("loadDay(contact): 빈 spreadsheetId → [no-sheet] throw", async () => {
    const { loadDay } = await import("@/service/contact");
    expect(await rejectionOf(loadDay("trainer@x.com", "2026-07-28"))).toMatch(
      /^\[no-sheet\]/,
    );
  });

  it("loadWeekMeetings: 빈 spreadsheetId → [no-sheet] throw", async () => {
    const { loadWeekMeetings } = await import("@/service/contact-week");
    expect(await rejectionOf(loadWeekMeetings("trainer@x.com", "2026-07-24"))).toMatch(
      /^\[no-sheet\]/,
    );
  });
});
