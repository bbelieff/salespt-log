/**
 * 단위 테스트 — `lib/service/profile-bundle-cache.ts` 의 SWR(stale-while-revalidate) 판정.
 *
 * BBE-249 — /admin/users N+1 캐시를 TTL → SWR 로 교체한 핵심 로직 검증:
 *   신선(FRESH) → 즉시 반환·통신 0회 · 낡음(GRACE 이내) → 즉시 반환 + 백그라운드 갱신(비차단) ·
 *   완전 콜드(GRACE 초과·최초) → 동기 fetch · 동시 호출(같은 key) → in-flight 1회로 dedup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadProfileBundle } = vi.hoisted(() => ({
  mockReadProfileBundle: vi.fn(),
}));
vi.mock("@/repo/sales", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/repo/sales")>()),
  readProfileBundle: mockReadProfileBundle,
}));

import {
  readBundle,
  _getSheetBundleFetchCount,
  _resetSheetBundleFetchCount,
  _resetBundleCacheForTest,
} from "@/service/profile-bundle-cache";

/** 백그라운드 갱신(then/catch 체인)이 끝나도록 마이크로태스크 큐를 비운다.
 * fake timers 는 타이머만 멈출 뿐 네이티브 Promise 마이크로태스크는 그대로 흐르므로
 * await 를 여러 번 겹치면 충분하다(vi.waitFor 는 콜백이 즉시 성공해 실제로 안 기다림). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

const BUNDLE = {
  cohort: "8기", name: "홍길동",
  courseStart: new Date(2026, 0, 1), graduation: new Date(2026, 2, 20),
  stats: { 미팅예정: 1, 미팅완료: 2, 계약: 3 },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
  mockReadProfileBundle.mockReset().mockResolvedValue(BUNDLE);
  _resetBundleCacheForTest();
  _resetSheetBundleFetchCount();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("readBundle — 콜드(최초) 호출", () => {
  it("캐시가 없으면 동기 fetch 1회 후 값을 반환한다", async () => {
    const b = await readBundle("sid-1");
    expect(b).toEqual(BUNDLE);
    expect(_getSheetBundleFetchCount()).toBe(1);
  });

  it("동시(같은 tick) 호출 N개는 in-flight 1회로 합쳐진다(부부/멀티계정 공유 spreadsheetId)", async () => {
    const [a, b, c] = await Promise.all([
      readBundle("sid-shared"),
      readBundle("sid-shared"),
      readBundle("sid-shared"),
    ]);
    expect(a).toEqual(BUNDLE);
    expect(b).toEqual(BUNDLE);
    expect(c).toEqual(BUNDLE);
    expect(_getSheetBundleFetchCount()).toBe(1);
    expect(mockReadProfileBundle).toHaveBeenCalledTimes(1);
  });
});

describe("readBundle — FRESH 구간(10분 이내)", () => {
  it("재호출은 통신 0회로 같은 값을 반환한다", async () => {
    await readBundle("sid-2");
    expect(_getSheetBundleFetchCount()).toBe(1);

    vi.advanceTimersByTime(9 * 60_000); // 9분 경과 — 아직 FRESH
    const b = await readBundle("sid-2");
    expect(b).toEqual(BUNDLE);
    expect(_getSheetBundleFetchCount()).toBe(1); // 추가 통신 없음
  });
});

describe("readBundle — STALE 구간(10분~30분, BBE-249 핵심)", () => {
  it("낡은 값을 즉시 반환하고(차단 없음) 백그라운드에서 1회만 갱신한다", async () => {
    await readBundle("sid-3");
    expect(_getSheetBundleFetchCount()).toBe(1);

    vi.advanceTimersByTime(15 * 60_000); // 15분 경과 — STALE(10~30분 구간)
    mockReadProfileBundle.mockResolvedValueOnce({ ...BUNDLE, stats: { 미팅예정: 9, 미팅완료: 9, 계약: 9 } });

    const stale = await readBundle("sid-3");
    // 즉시 반환된 값은 "이전" 값(백그라운드 갱신은 아직 미완료) — 차단하지 않았다는 증거.
    expect(stale.stats).toEqual(BUNDLE.stats);
    expect(_getSheetBundleFetchCount()).toBe(2); // 백그라운드 fetch 는 이미 발사됨(비차단으로 발사만)

    await flushMicrotasks(); // 백그라운드 갱신 완료 대기
    const refreshed = await readBundle("sid-3"); // 여전히 STALE 구간(시간 안 지남) → 갱신된 값 캐시에서 반환
    expect(refreshed.stats).toEqual({ 미팅예정: 9, 미팅완료: 9, 계약: 9 });
    expect(_getSheetBundleFetchCount()).toBe(2); // 추가 통신 없음(갱신본을 그대로 서빙)
  });

  it("같은 STALE 구간에서 여러 번 호출해도 백그라운드 갱신은 1회만 발사된다(refreshing 플래그)", async () => {
    await readBundle("sid-4");
    vi.advanceTimersByTime(12 * 60_000);
    await Promise.all([readBundle("sid-4"), readBundle("sid-4"), readBundle("sid-4")]);
    expect(_getSheetBundleFetchCount()).toBe(2); // 최초 1 + 백그라운드 갱신 1(중복 발사 없음)
  });

  it("백그라운드 갱신이 실패해도 예외를 던지지 않고 이전 값을 유지한다", async () => {
    await readBundle("sid-5");
    vi.advanceTimersByTime(15 * 60_000);
    mockReadProfileBundle.mockRejectedValueOnce(new Error("sheets 500"));
    const stale = await readBundle("sid-5");
    expect(stale).toEqual(BUNDLE); // 여전히 이전 값 — 호출부에 예외 전파 없음
    await flushMicrotasks();
    // 실패 후 refreshing 플래그가 풀려 다음 호출에서 재시도 가능해야 한다.
    mockReadProfileBundle.mockResolvedValueOnce({ ...BUNDLE, name: "재시도성공" });
    vi.advanceTimersByTime(1); // 여전히 STALE 구간
    const retried = await readBundle("sid-5");
    expect(_getSheetBundleFetchCount()).toBe(3); // 최초1 + 실패1 + 재시도1
    void retried;
  });
});

describe("readBundle — GRACE 초과(30분+)", () => {
  it("보여줄 신선한 값이 없으므로 동기 fetch 로 폴백한다(기존 콜드와 동일 동작)", async () => {
    await readBundle("sid-6");
    vi.advanceTimersByTime(31 * 60_000); // GRACE(30분) 초과
    mockReadProfileBundle.mockResolvedValueOnce({ ...BUNDLE, name: "완전갱신" });
    const b = await readBundle("sid-6");
    expect(b.name).toBe("완전갱신"); // 백그라운드가 아니라 이번 호출이 직접 최신값을 받는다
    expect(_getSheetBundleFetchCount()).toBe(2);
  });
});
