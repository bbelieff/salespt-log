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

// dashboard 모듈 그래프만 pg Pool(@/repo/db/client)·analytics 를 끌어와 **핸들이 열린 채** teardown
// 이 15s 까지 늘어졌다(전체 스위트 부하에서 타임아웃 → 전 트랙 pre-commit 차단). 가드는 사용자
// 해석 직후 최전방이라 이 둘에 **도달하지 못하고** throw 하므로, 목킹해도 검증 대상은 그대로다.
vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => false,
  readSalesRowsFromDb: vi.fn(async () => []),
  getDbPool: vi.fn(() => { throw new Error("no-sheet 가드 전에 DB 를 열면 안 된다"); }),
  ensureSchema: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: vi.fn(async () => {}),
  withApiTiming: (_n: string, h: unknown) => h,
}));
// googleapis 는 모듈 로딩만으로 수 초를 먹는다(repo 레이어가 끌어옴). 가드는 시트 호출 전에
// throw 하므로 스텁으로 충분 — 호출되면 그 자체가 회귀 신호라 throw 로 잡는다.
vi.mock("googleapis", () => ({
  google: {
    sheets: () => { throw new Error("no-sheet 가드 전에 시트를 부르면 안 된다"); },
    auth: { GoogleAuth: class {} },
  },
}));

// R4 W1-1 추가(#638 목킹 위에): 대상 모듈을 **정적 import** 로 올린다. 동적 `await import()` 를 테스트
// 본문에서 하면 남은 transform 비용이 **per-test 타임아웃 안**에 들어와, 느린 머신에서 목킹 후에도
// 15s 를 넘겼다(실측). 정적 import 는 그 비용을 collect 단계(무제한)로 옮긴다 — 검증 대상 불변.
import { loadDashboard } from "@/service/dashboard";
import { loadDay } from "@/service/contact";
import { loadWeekMeetings } from "@/service/contact-week";

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
  // #638 목킹(googleapis·pg Pool·analytics) + 정적 import 로 잔여 transform 을 collect 로 이관 →
  // 테스트 본문은 ms 단위. per-test 타임아웃 오버라이드는 불필요해져 제거(전역 기본값 사용).
  it("loadDashboard: 빈 spreadsheetId → [no-sheet] throw", async () => {
    expect(await rejectionOf(loadDashboard("trainer@x.com"))).toMatch(/^\[no-sheet\]/);
  });

  it("loadDay(contact): 빈 spreadsheetId → [no-sheet] throw", async () => {
    expect(await rejectionOf(loadDay("trainer@x.com", "2026-07-28"))).toMatch(
      /^\[no-sheet\]/,
    );
  });

  it("loadWeekMeetings: 빈 spreadsheetId → [no-sheet] throw", async () => {
    expect(await rejectionOf(loadWeekMeetings("trainer@x.com", "2026-07-24"))).toMatch(
      /^\[no-sheet\]/,
    );
  });
});
