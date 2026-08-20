/**
 * 단위 테스트 — `lib/service/me.ts`의 D-day 계산 정합성.
 *
 * SSOT: ADR-0005 (주차 카운팅 컨벤션).
 *   7기+ 현행 모델: graduationISO = courseStartISO(O1) + 50d (종강총회일 = 수료일).
 *   (6기 이하 legacy 는 O1+57 이지만 그 시트들은 O2 직접값이 진실이라 fixture
 *    검증 대상 아님 — 이 테스트는 7기+ 모델만 검증.)
 *
 * 7기 검증 fixture: O1 = 2026-05-15(금) → graduationISO = 2026-07-04(토)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// BBE-64 — enrichUsersWithStats 게이팅/병합 테스트용 목킹.
// vi.mock factory 는 파일 최상단으로 호이스팅되므로 참조 변수는 vi.hoisted 로 선언
// (expense-category-lifecycle-r6.test.ts 와 동일 컨벤션).
const { mockDbEnabled, mockProfileStatsFromDb, mockReadProfileBundle } = vi.hoisted(() => ({
  mockDbEnabled: vi.fn(() => true), // per-test 오버라이드 필요해 vi.fn()
  mockProfileStatsFromDb: vi.fn(),
  mockReadProfileBundle: vi.fn(),
}));
// scoreboard-cache-date.test.ts 와 동일 컨벤션 — unstable_cache 를 JSON 왕복 패스스루로
// 목킹(라이브 캐시 히트의 직렬화를 모사). 목킹 없이는 me.ts 의 cachedReadBundle 이
// Vitest 환경에서 결정적으로 동작하지 않는다(캐시 스토리지가 request-scope 밖에서 미정의).
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...a: unknown[]) => Promise<unknown>) =>
    async (...a: unknown[]) =>
      JSON.parse(JSON.stringify(await fn(...a))),
  revalidateTag: () => {},
}));
vi.mock("@/repo/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/db/client")>()),
  dbEnabled: mockDbEnabled,
}));
vi.mock("@/service/profile-stats-db", () => ({
  profileStatsFromDb: mockProfileStatsFromDb,
}));
vi.mock("@/repo/sales", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/sales")>()),
  readProfileBundle: mockReadProfileBundle,
}));

import {
  GRADUATION_OFFSET_DAYS,
  computeGraduationISO,
  enrichUsersWithDates,
  enrichUsersWithStats,
  _resetBundleCacheForTest,
} from "@/service/me";

// BBE-249 — readBundle 이 SWR 인메모리 캐시(spreadsheetId 키)로 바뀌어 테스트 간 상태가
// 새 지 않으면 서로 오염될 수 있다. 각 테스트는 고유 spreadsheetId 를 쓰지만 안전하게 리셋.
beforeEach(() => {
  _resetBundleCacheForTest();
});

describe("GRADUATION_OFFSET_DAYS", () => {
  it("종강총회 offset = 50일 (7기+ 현행 모델, ADR-0005)", () => {
    expect(GRADUATION_OFFSET_DAYS).toBe(50);
  });
});

describe("computeGraduationISO — 7기 모델 (O1+50)", () => {
  it("O1=2026-05-15(금) → graduation=2026-07-04(토)", () => {
    expect(computeGraduationISO("2026-05-15")).toBe("2026-07-04");
  });

  it("월말 경계: 4/30 → 6/19 (5월 31d + 6월 19d = 50)", () => {
    expect(computeGraduationISO("2026-04-30")).toBe("2026-06-19");
  });

  it("연말 경계: 12/31 → 다음해 2/19 (1월 31d + 2월 19d = 50)", () => {
    expect(computeGraduationISO("2026-12-31")).toBe("2027-02-19");
  });

  it("윤년(2028) 2/29 → 4/19 (3월 31d + 4월 19d = 50)", () => {
    expect(computeGraduationISO("2028-02-29")).toBe("2028-04-19");
  });
});

describe("enrichUsersWithDates — 아레나 cohort 보호 (arena-cohort-display)", () => {
  it("cohort=A1-4, 시트캐시 cohortLabel=4 여도 A1-4 유지(아레나=레지스트리 SSOT)", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "A1-4",
        name: "고경희",
        spreadsheetId: "sheet-x",
        cohortLabel: "4", // 시트 B3 스테일 옛 기수
        nameLabel: "고경희",
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("A1-4");
  });
  it("일반 숫자 cohort 는 기존대로 cohortLabel 표시", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "8",
        name: "김현민",
        spreadsheetId: "sheet-y",
        cohortLabel: "8기",
        nameLabel: "김현민",
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("8기");
  });

  it("아레나 부부명 보호 — cohort=A1-3·시트 B3=3·C3=정유영 → A1-3·정유영(조성도) 유지", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "A1-3",
        name: "정유영(조성도)", // 레지스트리 SSOT (부부 괄호명)
        spreadsheetId: "sheet-z",
        cohortLabel: "3", // 시트 B3 옛 기수
        nameLabel: "정유영", // 시트 C3 단일명 (동반자 잘림)
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("A1-3");
    expect(r!.name).toBe("정유영(조성도)");
  });

  it("일반 기수 이름은 기존대로 시트값(nameLabel)으로 덮임", async () => {
    const [r] = await enrichUsersWithDates([
      {
        cohort: "7",
        name: "홍길동", // 레지스트리(괄호 없음·비아레나)
        spreadsheetId: "sheet-w",
        cohortLabel: "7기",
        nameLabel: "홍길동수정", // 시트 C3 = 표시 정본
        courseStartISO: "2026-06-12",
        graduationISO: "2026-08-01",
      },
    ]);
    expect(r!.cohort).toBe("7기");
    expect(r!.name).toBe("홍길동수정");
  });
});

// BBE-64 — enrichUsersWithStats 게이팅/병합. isDbReadPilot 은 실함수 사용(모킹 안 함) —
// 파일럿 판정은 cohort 문자열("8"/"연습"/"A1-…")로 자연스럽게 트리거.
describe("enrichUsersWithStats — 파일럿/비파일럿 게이팅 + 순서 보존 병합 (BBE-64)", () => {
  beforeEach(() => {
    mockDbEnabled.mockReset().mockReturnValue(true);
    mockProfileStatsFromDb.mockReset();
    mockReadProfileBundle.mockReset();
  });

  it("비파일럿 사용자는 DB 를 전혀 건드리지 않고 기존 시트 경로만 탄다", async () => {
    mockReadProfileBundle.mockResolvedValue({
      cohort: "7기", name: "홍길동",
      courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 1, 미팅완료: 2, 계약: 3 },
    });
    const [r] = await enrichUsersWithStats([
      { spreadsheetId: "sheet-nonpilot-1", cohort: "7", courseStartISO: "2026-01-01" },
    ]);
    expect(r!.stats).toEqual({ 미팅예정: 1, 미팅완료: 2, 계약: 3 });
    expect(mockProfileStatsFromDb).not.toHaveBeenCalled();
    expect(mockReadProfileBundle).toHaveBeenCalledTimes(1);
  });

  it("파일럿 사용자는 배치 DB 경로를 타고 시트를 건드리지 않는다", async () => {
    mockProfileStatsFromDb.mockResolvedValue([{ 미팅예정: 9, 미팅완료: 8, 계약: 7 }]);
    const [r] = await enrichUsersWithStats([
      { spreadsheetId: "sheet-pilot-1", cohort: "8", courseStartISO: "2026-01-01" },
    ]);
    expect(r!.stats).toEqual({ 미팅예정: 9, 미팅완료: 8, 계약: 7 });
    expect(mockReadProfileBundle).not.toHaveBeenCalled();
    expect(mockProfileStatsFromDb).toHaveBeenCalledTimes(1);
  });

  it("혼합 배치(비파일럿·파일럿·admin 빈 spreadsheetId 포함) — 원래 순서 보존", async () => {
    mockProfileStatsFromDb.mockResolvedValue([{ 미팅예정: 5, 미팅완료: 5, 계약: 5 }]);
    mockReadProfileBundle.mockResolvedValue({
      cohort: "1기", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 1, 미팅완료: 1, 계약: 1 },
    });
    const input = [
      { spreadsheetId: "sheet-nonpilot-2", cohort: "1", courseStartISO: "2026-01-01", email: "a@x.com" },
      { spreadsheetId: "sheet-pilot-2", cohort: "8", courseStartISO: "2026-01-01", email: "b@x.com" },
      { spreadsheetId: "", cohort: "T", courseStartISO: "", email: "admin@x.com" }, // 트레이너/admin 행
    ];
    const out = await enrichUsersWithStats(input);
    expect(out.map((u) => u.email)).toEqual(["a@x.com", "b@x.com", "admin@x.com"]);
    expect(out[0]!.stats).toEqual({ 미팅예정: 1, 미팅완료: 1, 계약: 1 });
    expect(out[1]!.stats).toEqual({ 미팅예정: 5, 미팅완료: 5, 계약: 5 });
    expect(out[2]!.stats).toBeUndefined(); // spreadsheetId 없음 — 시트 경로 진입도 안 함(기존 동작)
    expect(mockReadProfileBundle).toHaveBeenCalledTimes(1); // admin 행은 read 시도조차 안 함
  });

  it("전원 비파일럿이면 profileStatsFromDb 는 한 번도 호출되지 않는다 (회귀 가드)", async () => {
    mockReadProfileBundle.mockResolvedValue({
      cohort: "1기", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 0, 미팅완료: 0, 계약: 0 },
    });
    await enrichUsersWithStats([
      { spreadsheetId: "sheet-nonpilot-3", cohort: "1", courseStartISO: "2026-01-01" },
      { spreadsheetId: "sheet-nonpilot-4", cohort: "2", courseStartISO: "2026-01-01" },
    ]);
    expect(mockProfileStatsFromDb).not.toHaveBeenCalled();
  });

  it("파일럿 cohort 인데 courseStartISO 가 없으면(dates 미실행/실패) 시트 경로로 떨어진다", async () => {
    mockReadProfileBundle.mockResolvedValue({
      cohort: "8기", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 2, 미팅완료: 2, 계약: 2 },
    });
    const [r] = await enrichUsersWithStats([
      { spreadsheetId: "sheet-pilot-nodates", cohort: "8", courseStartISO: "" },
    ]);
    expect(mockProfileStatsFromDb).not.toHaveBeenCalled();
    expect(r!.stats).toEqual({ 미팅예정: 2, 미팅완료: 2, 계약: 2 });
  });

  it("파일럿 배치 DB 조회가 실패하면 그 배치 전원이 시트 경로로 폴백한다", async () => {
    mockProfileStatsFromDb.mockRejectedValue(new Error("pg connection reset"));
    mockReadProfileBundle.mockResolvedValue({
      cohort: "9기", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 4, 미팅완료: 4, 계약: 4 },
    });
    const out = await enrichUsersWithStats([
      { spreadsheetId: "sheet-pilot-fallback-1", cohort: "9", courseStartISO: "2026-01-01" },
      { spreadsheetId: "sheet-pilot-fallback-2", cohort: "9", courseStartISO: "2026-01-01" },
    ]);
    expect(out[0]!.stats).toEqual({ 미팅예정: 4, 미팅완료: 4, 계약: 4 });
    expect(out[1]!.stats).toEqual({ 미팅예정: 4, 미팅완료: 4, 계약: 4 });
    expect(mockReadProfileBundle).toHaveBeenCalledTimes(2); // 폴백된 2명 전부 시트로
  });

  it("dbEnabled() 가 false 면 파일럿 cohort 라도 전원 시트 경로", async () => {
    mockDbEnabled.mockReturnValue(false);
    mockReadProfileBundle.mockResolvedValue({
      cohort: "8기", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 0, 미팅완료: 0, 계약: 0 },
    });
    await enrichUsersWithStats([
      { spreadsheetId: "sheet-pilot-dboff", cohort: "8", courseStartISO: "2026-01-01" },
    ]);
    expect(mockProfileStatsFromDb).not.toHaveBeenCalled();
    expect(mockReadProfileBundle).toHaveBeenCalledTimes(1);
  });

  // 적대적 리뷰(2026-08-06)에서 확인된 실제 버그의 회귀 가드. 부부/멀티계정은 시트를
  // 공유해 같은 spreadsheetId 를 쓴다(lib/repo/users-claim.ts). /captain 화면
  // (listArenaCohortMembers)은 이런 중복 행을 거르지 않아 실제로 도달 가능 —
  // spreadsheetId 로 결과를 키 잡으면 한쪽이 다른 쪽 통계로 덮어써진다(수정 전 실측 확인).
  it("부부/멀티계정 — 같은 spreadsheetId 를 공유해도 각자 자기 결과를 받는다(index 병합)", async () => {
    mockProfileStatsFromDb.mockResolvedValue([
      { 미팅예정: 1, 미팅완료: 1, 계약: 1 }, // 첫 번째 사용자용
      { 미팅예정: 99, 미팅완료: 99, 계약: 99 }, // 두 번째 사용자용(다른 courseStart 창)
    ]);
    const out = await enrichUsersWithStats([
      { spreadsheetId: "shared-sheet", cohort: "8", courseStartISO: "2026-01-01", email: "husband@x.com" },
      { spreadsheetId: "shared-sheet", cohort: "8", courseStartISO: "2026-03-01", email: "wife@x.com" },
    ]);
    expect(out[0]!.stats).toEqual({ 미팅예정: 1, 미팅완료: 1, 계약: 1 });
    expect(out[1]!.stats).toEqual({ 미팅예정: 99, 미팅완료: 99, 계약: 99 }); // 덮어써지지 않음
    // profileStatsFromDb 는 두 사용자 몫(courseStart 다름)을 각각 넘겨받는다.
    expect(mockProfileStatsFromDb).toHaveBeenCalledWith([
      { spreadsheetId: "shared-sheet", courseStart: new Date(2026, 0, 1) },
      { spreadsheetId: "shared-sheet", courseStart: new Date(2026, 2, 1) },
    ]);
  });

  it("트레이너/admin 행 2개가 같은 배치에 있어도(spreadsheetId 둘 다 '') 서로 안 섞인다", async () => {
    mockReadProfileBundle.mockResolvedValue({
      cohort: "T", name: "x", courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
      stats: { 미팅예정: 0, 미팅완료: 0, 계약: 0 },
    });
    const out = await enrichUsersWithStats([
      { spreadsheetId: "", cohort: "T", courseStartISO: "", email: "trainer1@x.com" },
      { spreadsheetId: "", cohort: "T", courseStartISO: "", email: "trainer2@x.com" },
    ]);
    expect(out.map((u) => u.email)).toEqual(["trainer1@x.com", "trainer2@x.com"]);
    expect(out[0]!.stats).toBeUndefined();
    expect(out[1]!.stats).toBeUndefined();
    expect(mockReadProfileBundle).not.toHaveBeenCalled(); // spreadsheetId 없음 — read 시도 안 함
  });
});
