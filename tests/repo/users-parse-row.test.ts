/**
 * Regression test — parseRow 가 빈 status/role row 를 drop 하면 안 됨.
 *
 * 사고 (2026-05-12): registry F(status) 컬럼이 비어있는 옛 prep row 들이
 * Zod enum 검증 실패로 drop → findUserByEmail null → 모든 trainee 가 /claim
 * 으로 튕김. /admin/users 도 "0명" 표시.
 *
 * 직접 export 안 된 internal helper 라 listAllUsers 경유로 검증
 * — 시트 데이터 mock 후 결과 row 가 정확히 보존되는지 확인.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repo/sheets-client", () => ({
  readRange: vi.fn(),
  appendRows: vi.fn(),
  sheetsClient: vi.fn(),
}));
vi.mock("@/repo/drive-client", () => ({
  findSheetByExactName: vi.fn(),
}));
vi.mock("@/config", () => ({
  registry: () => ({ spreadsheetId: "test-reg", tab: "users" }),
  adminEmails: () => [],
  adminNames: () => ({}),
}));
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

import { readRange } from "@/repo/sheets-client";
import { listAllUsers, findUserByEmail } from "@/repo/users";

const mockRead = readRange as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRead.mockReset();
});

describe("parseRow — 빈 status 정규화 (사고 2026-05-12 regression guard)", () => {
  it("F 컬럼이 빈 문자열인 row 도 active 로 처리 — drop 금지", async () => {
    mockRead.mockResolvedValue([
      // [email, cohort, name, spreadsheetId, role, status, assignedTrainer]
      ["alice@example.com", "6", "앨리스", "sid-1", "trainee", "", ""],
      ["bob@example.com", "6", "밥", "sid-2", "trainee", "active", ""],
      ["carol@example.com", "6", "캐럴", "sid-3", "trainee", "pending", ""],
    ]);
    const users = await listAllUsers();
    expect(users.map((u) => u.email).sort()).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ]);
    const alice = users.find((u) => u.email === "alice@example.com")!;
    expect(alice.status).toBe("active");
    const carol = users.find((u) => u.email === "carol@example.com")!;
    expect(carol.status).toBe("pending");
  });

  it("F 컬럼이 누락된 row (undefined) 도 active 로 처리", async () => {
    mockRead.mockResolvedValue([
      ["alice@example.com", "6", "앨리스", "sid-1", "trainee"],
    ]);
    const u = await findUserByEmail("alice@example.com");
    expect(u).not.toBeNull();
    expect(u!.status).toBe("active");
  });

  it("E 컬럼(role)이 빈 문자열 → trainee 로 정규화", async () => {
    mockRead.mockResolvedValue([
      ["dave@example.com", "6", "데이브", "sid-4", "", "active", ""],
    ]);
    const u = await findUserByEmail("dave@example.com");
    expect(u).not.toBeNull();
    expect(u!.role).toBe("trainee");
  });

  it("E=trainer / F=pending 둘 다 명시 → 그대로 보존", async () => {
    mockRead.mockResolvedValue([
      ["eve@example.com", "T", "이브", "", "trainer", "pending", ""],
    ]);
    const u = await findUserByEmail("eve@example.com");
    expect(u).not.toBeNull();
    expect(u!.role).toBe("trainer");
    expect(u!.status).toBe("pending");
  });
});
