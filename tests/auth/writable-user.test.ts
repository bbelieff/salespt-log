/**
 * R4 W1-1 / ADR-0029(G1 = 편집 완전 해제) 회귀 —
 * `getWritableUserEmail` 은 **archived(수료·보관) 사용자를 더 이상 차단하지 않는다**.
 * 수료 후에도 자기 기록을 저장할 수 있어야 무제한 CRM 이 성립한다(구 archived-login-access 폐지).
 * 단 **인증 자체는 그대로 요구**한다(미인증 throw 불변) — 해제된 것은 "수료 여부"뿐.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const findUserByEmail = vi.fn();
const cookiesGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...a: unknown[]) => cookiesGet(...(a as [])) }),
}));
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => auth(...(a as [])) }));
vi.mock("@/auth/dev-stub", () => ({ isDevStubAuthed: () => false }));
vi.mock("@/config", () => ({ adminEmails: () => ["admin@x.y"] }));
vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
  parseAssignedTrainers: () => [],
}));

import { getWritableUserEmail } from "@/auth/identity";

const GRAD = "graduate@x.y";

beforeEach(() => {
  for (const m of [auth, findUserByEmail, cookiesGet]) m.mockReset();
  cookiesGet.mockReturnValue(undefined); // impersonation 없음
  auth.mockResolvedValue({ user: { email: GRAD } });
  findUserByEmail.mockResolvedValue({
    email: GRAD,
    status: "archived", // 수료(보관)
    role: "trainee",
    cohort: "7",
    spreadsheetId: "sheet-1",
  });
});

describe("getWritableUserEmail — 수료 후 쓰기 허용(ADR-0029 G1)", () => {
  it("archived 사용자도 쓰기 대상 이메일을 반환한다(throw 금지)", async () => {
    await expect(getWritableUserEmail()).resolves.toBe(GRAD);
  });

  it("active 사용자도 동일하게 반환(회귀 없음)", async () => {
    findUserByEmail.mockResolvedValue({
      email: GRAD, status: "active", role: "trainee", cohort: "9", spreadsheetId: "s",
    });
    await expect(getWritableUserEmail()).resolves.toBe(GRAD);
  });

  it("레지스트리에 없는 사용자도 통과(미등록 판정은 라우팅 몫)", async () => {
    findUserByEmail.mockResolvedValue(null);
    await expect(getWritableUserEmail()).resolves.toBe(GRAD);
  });

  it("미인증은 그대로 throw — 해제된 건 '수료 여부'뿐, 인증은 아니다", async () => {
    auth.mockResolvedValue(null);
    await expect(getWritableUserEmail()).rejects.toThrow("로그인");
  });
});
