/**
 * 사전 등록(prep) 행이 `listAllUsers` 에서 살아남는다 — 회귀 가드 ②.
 *
 * 배경(2026-09-01 belie 신고): 사전 등록 행은 **이메일이 빈 값**으로 만들어진다.
 * 그 행을 버리는 관문이 **두 곳**이었다:
 *   ① `User` 스키마 `email: z.string().email()` — 빈 값 검증 탈락 (별도 커밋에서 수정)
 *   ② `users.ts:listAllUsers` 의 `if (!r[0]) continue` — **email 이 비면 파싱조차 안 함** ← 여기
 * ①만 고치면 여전히 안 보인다. 실측으로 확인했다(스키마 수정 배포 후에도 63명 그대로).
 *
 * 여기서 못 박는 것:
 *   · 이메일이 비어도 이름·기수가 있으면 명단에 남는다
 *   · 완전히 빈 행은 여전히 버린다(시트 하단 빈 줄이 유령 사용자가 되면 안 된다)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ cachedRegistryRows: vi.fn() }));

vi.mock("@/repo/users-rows", () => ({
  cachedRegistryRows: api.cachedRegistryRows,
  invalidateRegistry: () => {},
}));
vi.mock("../../lib/repo/users-rows", () => ({
  cachedRegistryRows: api.cachedRegistryRows,
  invalidateRegistry: () => {},
}));

/** 시트 A~T 열 순서 그대로. */
const row = (email: string, cohort: string, name: string, sid: string) => [
  email, cohort, name, sid, "trainee", "active", "", "", "", "", "", "", "0", "", "", "", "", "", "", "",
];

describe("listAllUsers — 사전 등록 행 보존", () => {
  beforeEach(() => {
    vi.resetModules();
    api.cachedRegistryRows.mockReset();
  });

  it("★이메일이 비어도 명단에 남는다 — 사전 등록의 정상 상태다", async () => {
    api.cachedRegistryRows.mockResolvedValue([
      row("", "11", "이진호", "sheet-11-1"),
      row("a@b.com", "11", "우정연", "sheet-11-2"),
    ]);
    const { listAllUsers } = await import("@/repo/users");
    const users = await listAllUsers();

    expect(users.map((u) => u.name).sort()).toEqual(["우정연", "이진호"].sort());
    expect(users.find((u) => u.name === "이진호")?.email).toBe("");
  });

  it("★완전히 빈 행은 여전히 버린다 — 시트 하단 빈 줄이 유령이 되면 안 된다", async () => {
    api.cachedRegistryRows.mockResolvedValue([
      row("", "", "", ""),
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      row("", "11", "노경준", "sheet-11-3"),
    ]);
    const { listAllUsers } = await import("@/repo/users");
    const users = await listAllUsers();

    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe("노경준");
  });

  it("이메일 있는 기존 행은 그대로다", async () => {
    api.cachedRegistryRows.mockResolvedValue([row("x@y.com", "10", "김도연", "sheet-10")]);
    const { listAllUsers } = await import("@/repo/users");
    const users = await listAllUsers();

    expect(users).toHaveLength(1);
    expect(users[0]?.email).toBe("x@y.com");
  });
});
