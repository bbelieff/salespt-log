/**
 * BBE-242 처방2 — PostHog 지연 로딩(app/providers.tsx 의 window `load` 이후 init) 대비
 * init 전 호출 버퍼링·flush 회귀. "이벤트 유실 없이 순서대로 나간다" 요건의 핵심 증거.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPosthog = {
  __loaded: false,
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
};

vi.mock("posthog-js", () => ({ default: mockPosthog }));

describe("lib/analytics — init 전 호출 버퍼링", () => {
  beforeEach(() => {
    vi.resetModules();
    // 이 모듈은 브라우저 전용(typeof window 가드) — vitest 기본 environment("node")엔
    // window 가 없으므로 스텁한다(jsdom 미도입, 이 최소 스텁으로 충분).
    vi.stubGlobal("window", {});
    mockPosthog.__loaded = false;
    mockPosthog.capture.mockClear();
    mockPosthog.identify.mockClear();
    mockPosthog.reset.mockClear();
    mockPosthog.register.mockClear();
    mockPosthog.unregister.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("init 대기 중(운영+키 있음)의 호출은 버퍼링됐다가 flush 시 순서대로 나간다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-key");
    const { track, identifyUser, flushPendingAnalytics } = await import("./index");

    track("metrics_saved");
    identifyUser("a@b.com", { role: "trainee" });
    // init 전 — 아직 아무 것도 posthog 로 안 나갔다(유실 아니라 대기).
    expect(mockPosthog.capture).not.toHaveBeenCalled();
    expect(mockPosthog.identify).not.toHaveBeenCalled();

    mockPosthog.__loaded = true; // providers.tsx 의 posthog.init 완료 시뮬레이션
    flushPendingAnalytics(); // loaded 콜백에서 실제로 호출되는 지점

    expect(mockPosthog.identify).toHaveBeenCalledTimes(1);
    // capture 는 metrics_saved(track) + user_identified(identifyUser 내부) = 2회, 원래 순서 그대로.
    expect(mockPosthog.capture).toHaveBeenCalledTimes(2);
    expect(mockPosthog.capture.mock.calls[0]?.[0]).toBe("metrics_saved");
    expect(mockPosthog.capture.mock.calls[1]?.[0]).toBe("user_identified");
  });

  it("개발환경(NODE_ENV!=production 또는 키 없음)은 버퍼링 없이 영구 no-op — 기존 동작 그대로", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { track, flushPendingAnalytics } = await import("./index");

    track("metrics_saved");
    flushPendingAnalytics(); // init 이 애초에 안 되는 환경 — flush 해도 무의미
    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  it("이미 ready(__loaded=true)면 버퍼를 거치지 않고 즉시 실행된다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-key");
    mockPosthog.__loaded = true;
    const { track } = await import("./index");

    track("todo_created");
    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(mockPosthog.capture).toHaveBeenCalledWith("todo_created", undefined);
  });

  it("email 빈 값이면 identifyUser 는 버퍼링조차 안 하고 즉시 반환(기존 가드 보존)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-key");
    const { identifyUser, flushPendingAnalytics } = await import("./index");

    identifyUser("", { role: "trainee" });
    mockPosthog.__loaded = true;
    flushPendingAnalytics();
    expect(mockPosthog.identify).not.toHaveBeenCalled();
  });
});
