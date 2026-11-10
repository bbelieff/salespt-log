/** 서버 쓰기 검사: 탭 지문이 지금 신원과 다르면 getWritableUserEmail 이 거부한다. 가상 이메일만. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { header: null as string | null, as: undefined as string | undefined };
vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.header ? { "x-salespt-tab-identity": state.header } : {}),
  cookies: async () => ({ get: (k: string) => (k === "salespt_as" && state.as ? { value: state.as } : undefined) }),
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "me@example.test" } }) }));

import { identityFingerprint } from "@/auth/identity-fingerprint";
import { assertTabIdentity, TabIdentityMismatchError } from "@/auth/identity";

describe("assertTabIdentity", () => {
  beforeEach(() => { state.header = null; state.as = undefined; });
  it("머리말이 없으면 검사하지 않는다(옛 탭·서버 호출)", async () => {
    await expect(assertTabIdentity()).resolves.toBeUndefined();
  });
  it("탭 지문 = 지금 신원이면 통과", async () => {
    state.header = identityFingerprint("me@example.test");
    await expect(assertTabIdentity()).resolves.toBeUndefined();
  });
  it("★탭 지문이 다르면 저장을 막는다", async () => {
    state.header = identityFingerprint("other@example.test");
    await expect(assertTabIdentity()).rejects.toBeInstanceOf(TabIdentityMismatchError);
  });
});
