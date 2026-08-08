/**
 * 레지스트리 DB 미러 **격리** 회귀 (BBE-55 수용 기준 ③ "DB 미러 실패가 앱 동작에 영향 0").
 *
 * 고정하는 계약:
 *   ① 미러 함수는 **동기 void** — 호출 즉시 반환한다(시트 쓰기 응답을 붙잡지 않는다).
 *   ② DB 가 계속 실패해도 호출부로 예외가 새지 않는다(unhandled rejection 도 없음).
 *   ③ 최종 실패는 warn 로그 + PostHog(db_mirror_error) 로만 관측된다.
 *   ④ 일시 실패는 재시도로 흡수된다(1회 실패 후 성공 → 경고 없음).
 *   ⑤ DATABASE_URL 미설정이면 DB 함수를 아예 호출하지 않는다.
 *
 * 이게 깨지면 = 시트 저장은 됐는데 사용자에게 500 이 뜨는 사고. R2 에서 확립된 불변.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbEnabled = vi.fn(() => true);
const upsertUserRow = vi.fn(async () => {});
const upsertUserCells = vi.fn(async () => {});
const deleteUserRow = vi.fn(async () => {});
const rekeyUserRow = vi.fn(async () => {});
const upsertCohortRow = vi.fn(async () => {});
const upsertCohortCells = vi.fn(async () => {});
const captureServerEvent = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@/repo/db/registry", async () => {
  const actual = await vi.importActual<typeof import("@/repo/db/registry")>("@/repo/db/registry");
  return {
    ...actual,
    upsertUserRow: (...a: unknown[]) => upsertUserRow(...(a as [])),
    upsertUserCells: (...a: unknown[]) => upsertUserCells(...(a as [])),
    deleteUserRow: (...a: unknown[]) => deleteUserRow(...(a as [])),
    rekeyUserRow: (...a: unknown[]) => rekeyUserRow(...(a as [])),
    upsertCohortRow: (...a: unknown[]) => upsertCohortRow(...(a as [])),
    upsertCohortCells: (...a: unknown[]) => upsertCohortCells(...(a as [])),
  };
});

import {
  mirrorCohortCells,
  mirrorUserCells,
  mirrorUserDelete,
  mirrorUserRow,
  registryRowFromSheetRow,
  cohortRowFromSheetRow,
} from "@/repo/db/registry-mirror";

const KEY = { email: "a@b.com", cohort: "A2-7기", name: "홍길동" };
const ROW = registryRowFromSheetRow(["a@b.com", "A2-7기", "홍길동", "sheet-1"]);

/** 미러의 내부 재시도(선형 백오프 300·600·900ms = 최대 1800ms)를 가상 시간으로 소진한다.
 * 실제 타이머로 기다리면 앞 테스트의 잔여 재시도가 다음 테스트로 새어 오염된다. */
const settle = () => vi.advanceTimersByTimeAsync(2000);

beforeEach(() => {
  vi.useFakeTimers();
  dbEnabled.mockReset().mockReturnValue(true);
  upsertUserRow.mockReset().mockResolvedValue(undefined);
  upsertUserCells.mockReset().mockResolvedValue(undefined);
  deleteUserRow.mockReset().mockResolvedValue(undefined);
  rekeyUserRow.mockReset().mockResolvedValue(undefined);
  upsertCohortRow.mockReset().mockResolvedValue(undefined);
  upsertCohortCells.mockReset().mockResolvedValue(undefined);
  captureServerEvent.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  // 남은 재시도를 모두 흘려보낸 뒤 실제 타이머로 복귀 — 테스트 간 오염 차단.
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("미러는 호출부를 절대 막지도 깨뜨리지도 않는다", () => {
  it("DB 가 영구 실패해도 호출부로 throw 하지 않는다", async () => {
    upsertUserCells.mockRejectedValue(new Error("connection refused"));
    expect(() => mirrorUserCells(KEY, { F: "archived" })).not.toThrow();
    await settle();
    expect(upsertUserCells).toHaveBeenCalledTimes(3); // 선형 백오프 3회
    expect(captureServerEvent).toHaveBeenCalledWith("db_mirror_error", { tab: "registry" });
  });

  it("일시 실패는 재시도로 흡수 — 경고를 남기지 않는다", async () => {
    upsertUserRow
      .mockRejectedValueOnce(new Error("일시 blip"))
      .mockResolvedValueOnce(undefined);
    mirrorUserRow(ROW);
    await settle();
    expect(upsertUserRow).toHaveBeenCalledTimes(2);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("에러 메시지의 접속 문자열은 로그에서 가려진다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deleteUserRow.mockRejectedValue(new Error("failed postgresql://user:pw@host/db timeout"));
    mirrorUserDelete(KEY);
    await settle();
    const logged = warn.mock.calls.map((c) => String(c[0])).join(" ");
    expect(logged).toContain("[DATABASE_URL]");
    expect(logged).not.toContain("pw@host");
  });

  it("알 수 없는 열문자도 동기 throw 하지 않는다(성공한 시트 쓰기를 500 으로 만들지 않음)", async () => {
    // 열문자→컬럼 변환이 비동기 경계 밖에 있으면 이 호출이 그대로 터진다(적대검증 4).
    expect(() => mirrorUserCells(KEY, { ZZ: "값" })).not.toThrow();
    await settle();
    expect(upsertUserCells).not.toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith("db_mirror_error", { tab: "registry" });
  });

  it("미러 호출은 동기 반환 — DB 가 끝나지 않아도 즉시 제어를 돌려준다", () => {
    let resolved = false;
    upsertCohortCells.mockImplementation(() => new Promise(() => {})); // 영원히 pending
    mirrorCohortCells("A2", { J: "2026-08-07" });
    resolved = true; // 이 줄에 도달했다는 것 자체가 non-blocking 증거
    expect(resolved).toBe(true);
    expect(upsertCohortCells).toHaveBeenCalled();
  });
});

describe("DATABASE_URL 미설정 = 완전 no-op", () => {
  beforeEach(() => dbEnabled.mockReturnValue(false));

  it("DB 함수를 아예 호출하지 않는다", async () => {
    mirrorUserRow(ROW);
    mirrorUserCells(KEY, { F: "active" });
    mirrorUserDelete(KEY);
    mirrorCohortCells("A2", { B: "active" });
    await settle();
    expect(upsertUserRow).not.toHaveBeenCalled();
    expect(upsertUserCells).not.toHaveBeenCalled();
    expect(deleteUserRow).not.toHaveBeenCalled();
    expect(upsertCohortCells).not.toHaveBeenCalled();
  });
});

describe("시트 원시 행 → 미러 행 변환", () => {
  it("users A~T 를 스키마 필드로 옮긴다(빈 칸은 기본값)", () => {
    const r = registryRowFromSheetRow([
      "A@B.com ", "7", "홍길동", "sid", "", "", "t@x.com", "서울",
      "PRM 7기", "홍길동", "2026-01-01", "2026-02-20", "3",
      "", "ffid", "ok", "회장", "A1-1", "tok", "{}",
    ]);
    expect(r.role).toBe("trainee"); // 빈 값 → 기본값
    expect(r.status).toBe("active");
    expect(r.sortOrder).toBe(3);
    expect(r.memo).toBe("회장");
    expect(r.captainOf).toBe("A1-1");
    expect(r.gcalSettings).toBe("{}");
  });

  it("prep 행(email 빈칸)도 name·cohort 로 식별된다", () => {
    const r = registryRowFromSheetRow(["", "A2-7기", "김철수", "sid"]);
    expect(r.email).toBe("");
    expect(r.cohort).toBe("A2-7기");
    expect(r.name).toBe("김철수");
  });

  it("cohorts A~J 를 스키마 필드로 옮긴다", () => {
    const c = cohortRowFromSheetRow(["A2", "active", "", "arena", "", "", "", "", "", "2026-08-07"]);
    expect(c.label).toBe("A2");
    expect(c.type).toBe("arena");
    expect(c.seasonStartISO).toBe("2026-08-07");
  });
});
