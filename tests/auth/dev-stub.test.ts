import { describe, it, expect, afterEach, vi } from "vitest";
import { isDevStubAuthed } from "@/auth/dev-stub";

/** dev stub 가드 — 미들웨어/identity.ts 공용. 프로덕션 무영향이 핵심. */
describe("isDevStubAuthed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("dev + STUB_USER_EMAIL 설정 → true (미들웨어 통과)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUB_USER_EMAIL", "practice@salespt.local");
    expect(isDevStubAuthed()).toBe(true);
  });

  it("STUB_USER_EMAIL 없으면 → false", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUB_USER_EMAIL", "");
    expect(isDevStubAuthed()).toBe(false);
  });

  it("production 이면 STUB 있어도 → false (프로덕션 동작 불변)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUB_USER_EMAIL", "practice@salespt.local");
    expect(isDevStubAuthed()).toBe(false);
  });
});
