/**
 * 캐시 워밍 회귀 (2026-08-30 belie 시연 중 지연 신고).
 *
 * 사고: `/admin/users` 가 캐시 빈 상태에서 40초+ 동안 통계를 못 채웠다(따뜻하면 261ms).
 * 캐시가 비는 순간은 ①배포(pm2 reload) ②GRACE(30분) 방치 — 둘 다 사람이 먼저 걸린다.
 *
 * 여기서 고정하는 계약:
 *   ① 활성 수강생 전원의 bundle 을 미리 읽는다(중복 시트ID 는 1회만).
 *   ② 한 명이 실패해도 나머지를 계속 데운다 — 실패가 워밍 전체를 죽이지 않는다.
 *   ③ 워밍끼리 겹쳐 돌지 않는다.
 *   ④ 끄는 스위치(`CACHE_WARM_DISABLED`)와 환경 게이트가 실제로 동작한다.
 *   ⑤ 주기가 GRACE(30분)보다 **짧다** — 이게 깨지면 워밍 사이에 캐시가 만료돼 사고 재발.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const readBundle = vi.fn();
const listDistinctUsers = vi.fn();

vi.mock("@/repo/users", () => ({
  listDistinctUsers: (...a: unknown[]) => listDistinctUsers(...a),
}));
vi.mock("@/service/profile-bundle-cache", () => ({
  readBundle: (...a: unknown[]) => readBundle(...a),
}));
// 상대경로 import 도 같은 모듈을 가리키도록
vi.mock("../../lib/service/profile-bundle-cache", () => ({
  readBundle: (...a: unknown[]) => readBundle(...a),
}));

const trainee = (email: string, spreadsheetId: string, over: Record<string, unknown> = {}) => ({
  email,
  spreadsheetId,
  role: "trainee",
  status: "active",
  ...over,
});

/** 레지스트리 캐시 컬럼(I~L)이 완비된 학생 — 페이지가 시트를 안 읽는 쪽. */
const cached = (email: string, spreadsheetId: string) =>
  trainee(email, spreadsheetId, {
    cohortLabel: "8기",
    nameLabel: "홍길동",
    courseStartISO: "2026-08-07",
    graduationISO: "2026-09-26",
  });

beforeEach(() => {
  vi.resetModules();
  readBundle.mockReset().mockResolvedValue({ ok: true });
  listDistinctUsers.mockReset();
});

async function load() {
  return await import("@/service/cache-warm");
}

describe("warmAllTraineeBundles", () => {
  it("① 활성 수강생 전원을 데운다 — 시트ID 중복은 1회만", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("a@x.com", "sheet-a"),
      trainee("b@x.com", "sheet-b"),
      trainee("c@x.com", "sheet-a"), // 같은 시트 → 중복 제거
    ]);
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles({ concurrency: 1 });

    expect(r.targets).toBe(2);
    expect(r.ok).toBe(2);
    expect(readBundle).toHaveBeenCalledTimes(2);
    expect(readBundle.mock.calls.map((c) => c[0]).sort()).toEqual(["sheet-a", "sheet-b"]);
  });

  it("① 대상이 아닌 사람은 건드리지 않는다 — 비활성·트레이너·시트없음", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("ok@x.com", "sheet-ok"),
      trainee("pending@x.com", "sheet-p", { status: "pending" }),
      trainee("trainer@x.com", "sheet-t", { role: "trainer" }),
      trainee("nosheet@x.com", ""),
    ]);
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles({ concurrency: 1 });

    expect(r.targets).toBe(1);
    expect(readBundle).toHaveBeenCalledTimes(1);
    expect(readBundle).toHaveBeenCalledWith("sheet-ok");
  });

  it("② 한 명이 실패해도 나머지를 계속 데운다", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("a@x.com", "sheet-a"),
      trainee("b@x.com", "sheet-b"),
      trainee("c@x.com", "sheet-c"),
    ]);
    readBundle.mockImplementation((id: string) =>
      id === "sheet-b" ? Promise.reject(new Error("시트 폴백 실패")) : Promise.resolve({}),
    );
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles({ concurrency: 1 });

    expect(r.ok).toBe(2);
    expect(r.failed).toBe(1);
    expect(readBundle).toHaveBeenCalledTimes(3);
  });

  it("② 레지스트리 조회 자체가 실패해도 던지지 않는다 — 다음 주기가 재시도", async () => {
    listDistinctUsers.mockRejectedValue(new Error("registry down"));
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles({ concurrency: 1 });

    expect(r.targets).toBe(0);
    expect(r.failed).toBe(0);
  });

  it("③ 앞 회차가 도는 중이면 이번 회차는 건너뛴다", async () => {
    let release: () => void = () => {};
    listDistinctUsers.mockResolvedValue([trainee("a@x.com", "sheet-a")]);
    readBundle.mockImplementation(() => new Promise((res) => { release = () => res({}); }));

    const { warmAllTraineeBundles } = await load();
    const first = warmAllTraineeBundles({ concurrency: 1 });
    const second = await warmAllTraineeBundles({ concurrency: 1 });

    expect(second.skipped).toBe(true);
    release();
    await first;
  });
});

describe("워밍 게이트", () => {
  it("④ CACHE_WARM_DISABLED=1 이면 안 돈다 — 재배포 없이 끄는 스위치", async () => {
    const { shouldWarm } = await load();
    expect(shouldWarm({ NODE_ENV: "production", CACHE_WARM_DISABLED: "1" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("④ 빌드 중에는 안 돈다 — next build 가 시트를 때리면 안 된다", async () => {
    const { shouldWarm } = await load();
    expect(shouldWarm({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("④ 개발 환경에서는 안 돈다 (강제 플래그로만 켠다)", async () => {
    const { shouldWarm } = await load();
    expect(shouldWarm({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldWarm({ NODE_ENV: "development", CACHE_WARM_FORCE: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("④ 운영에서는 기본으로 돈다", async () => {
    const { shouldWarm } = await load();
    expect(shouldWarm({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("동시성 계약", () => {
  it("**기본 동시성이 1보다 크다** — 순차 워밍은 63명에 몇 분이 걸려 워밍을 안 한 것과 같다", async () => {
    const { WARM_CONCURRENCY } = await load();
    expect(WARM_CONCURRENCY).toBeGreaterThan(1);
  });

  it("**앱이 같은 작업에 쓰는 동시성(pMapBundle 8)을 넘지 않는다** — Sheets 60/min 한도 보호", async () => {
    const { WARM_CONCURRENCY } = await load();
    expect(WARM_CONCURRENCY).toBeLessThanOrEqual(8);
  });

  it("실제로 병렬로 돈다 — 동시 실행 최대치가 1을 넘는다", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => trainee(`u${i}@x.com`, `sheet-${i}`));
    listDistinctUsers.mockResolvedValue(ids);
    let inflight = 0;
    let peak = 0;
    readBundle.mockImplementation(async () => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight -= 1;
      return {};
    });
    const { warmAllTraineeBundles, WARM_CONCURRENCY } = await load();
    const r = await warmAllTraineeBundles();

    expect(r.ok).toBe(20);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(WARM_CONCURRENCY);
  });
});

describe("주기 계약", () => {
  it("⑤ **워밍 주기가 캐시 GRACE(30분)보다 짧다** — 길어지면 사이에 캐시가 만료돼 사고 재발", async () => {
    const { WARM_INTERVAL_MS } = await load();
    const GRACE_MS = 30 * 60 * 1000;
    expect(WARM_INTERVAL_MS).toBeLessThan(GRACE_MS);
  });

  it("⑤ 기동 직후 잠깐 기다린다 — 배포 health 게이트와 안 겹치게", async () => {
    const { WARM_START_DELAY_MS } = await load();
    expect(WARM_START_DELAY_MS).toBeGreaterThan(0);
  });
});

describe("워밍 관측(getWarmStatus) — /api/health 노출용", () => {
  it("한 번도 안 돌았으면 hasRun=false", async () => {
    const { getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    const st = getWarmStatus();
    expect(st.hasRun).toBe(false);
    expect(st.ageSec).toBeNull();
    expect(st.lastMs).toBeNull();
  });

  it("돌고 나면 hasRun=true · 경과·소요시간·전건성공 여부가 잡힌다", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("a@x.com", "sheet-a"),
      trainee("b@x.com", "sheet-b"),
    ]);
    const { warmAllTraineeBundles, getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    await warmAllTraineeBundles();

    const st = getWarmStatus();
    expect(st.hasRun).toBe(true);
    expect(st.allOk).toBe(true);
    expect(st.ageSec).toBeGreaterThanOrEqual(0);
    expect(st.lastMs).toBeGreaterThanOrEqual(0);
  });

  it("일부 실패하면 allOk=false — 조용한 실패를 밖에서 본다", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("a@x.com", "sheet-a"),
      trainee("b@x.com", "sheet-b"),
    ]);
    readBundle.mockImplementation((id: string) =>
      id === "sheet-b" ? Promise.reject(new Error("boom")) : Promise.resolve({}),
    );
    const { warmAllTraineeBundles, getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    await warmAllTraineeBundles();

    expect(getWarmStatus().allOk).toBe(false);
  });

  it("**실데이터(인원수)를 노출하지 않는다** — /api/health 는 공개 엔드포인트다", async () => {
    listDistinctUsers.mockResolvedValue([trainee("a@x.com", "sheet-a")]);
    const { warmAllTraineeBundles, getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    await warmAllTraineeBundles();

    const keys = Object.keys(getWarmStatus()).sort();
    expect(keys).toEqual(["ageSec", "allOk", "enabled", "hasRun", "lastMs", "started"]);
  });
});

describe("루프 자가 기동 (멱등)", () => {
  it("**여러 번 불러도 한 번만 시작한다** — instrumentation + /api/health 양쪽에서 불린다", async () => {
    const { startCacheWarmLoop, getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    const st0 = getWarmStatus();
    expect(st0.started).toBe(false);

    // 운영이 아니면 게이트에서 막힌다 — 강제 플래그로 켠 상태를 흉내
    const prev = process.env.CACHE_WARM_FORCE;
    process.env.CACHE_WARM_FORCE = "1";
    try {
      startCacheWarmLoop();
      startCacheWarmLoop();
      startCacheWarmLoop();
      expect(getWarmStatus().started).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CACHE_WARM_FORCE;
      else process.env.CACHE_WARM_FORCE = prev;
    }
  });

  it("게이트가 꺼져 있으면 시작하지 않는다", async () => {
    const { startCacheWarmLoop, getWarmStatus, _resetWarmStateForTest } = await load();
    _resetWarmStateForTest();
    const prev = process.env.CACHE_WARM_DISABLED;
    process.env.CACHE_WARM_DISABLED = "1";
    try {
      startCacheWarmLoop();
      expect(getWarmStatus().started).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.CACHE_WARM_DISABLED;
      else process.env.CACHE_WARM_DISABLED = prev;
    }
  });
});

describe("워밍 대상 — 필요한 사람만", () => {
  it("**캐시 컬럼이 완비된 학생은 데우지 않는다** — 페이지가 어차피 시트를 안 읽는다", async () => {
    listDistinctUsers.mockResolvedValue([
      cached("done1@x.com", "sheet-done1"),
      cached("done2@x.com", "sheet-done2"),
      trainee("need@x.com", "sheet-need"), // 캐시 비어있음 → 페이지가 시트를 읽는다
    ]);
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles();

    expect(r.targets).toBe(1);
    expect(readBundle).toHaveBeenCalledTimes(1);
    expect(readBundle).toHaveBeenCalledWith("sheet-need");
  });

  it("전원 완비면 워밍이 아무것도 안 한다 — 쿼터 0 소모", async () => {
    listDistinctUsers.mockResolvedValue([
      cached("a@x.com", "sheet-a"),
      cached("b@x.com", "sheet-b"),
    ]);
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles();

    expect(r.targets).toBe(0);
    expect(readBundle).not.toHaveBeenCalled();
  });

  it("날짜가 ISO 형식이 아니면 미완비로 본다 — 시리얼 숫자 저장 사고 대비", async () => {
    listDistinctUsers.mockResolvedValue([
      trainee("serial@x.com", "sheet-serial", {
        cohortLabel: "8기",
        nameLabel: "홍길동",
        courseStartISO: "46241", // 시리얼 숫자 — ISO 아님
        graduationISO: "2026-09-26",
      }),
    ]);
    const { warmAllTraineeBundles } = await load();
    const r = await warmAllTraineeBundles();

    expect(r.targets).toBe(1);
  });
});
