import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSessionEmail: vi.fn(),
  isAdminEmail: vi.fn(),
  ensureCohortsTab: vi.fn(),
  setSeasonStart: vi.fn(),
  revalidateAdminPages: vi.fn(),
}));

vi.mock("@/auth/identity", () => ({
  getSessionEmail: api.getSessionEmail,
  isAdminEmail: api.isAdminEmail,
}));

vi.mock("@/auth/revalidate-admin", () => ({
  revalidateAdminPages: api.revalidateAdminPages,
}));

vi.mock("@/repo/cohorts", () => ({
  ensureCohortsTab: api.ensureCohortsTab,
  setSeasonStart: api.setSeasonStart,
}));

vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/admin/set-season-start/route";

function request(seasonStartISO: string) {
  return new Request("http://localhost/api/admin/set-season-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "A2", seasonStartISO }),
  });
}

async function responseBody(response: Response) {
  return { status: response.status, body: await response.json() };
}

function expectNoWrite() {
  expect(api.ensureCohortsTab).not.toHaveBeenCalled();
  expect(api.setSeasonStart).not.toHaveBeenCalled();
}

describe("POST /api/admin/set-season-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionEmail.mockResolvedValue("admin@example.com");
    api.isAdminEmail.mockReturnValue(true);
  });

  it("인증되지 않은 요청은 401이고 쓰지 않는다", async () => {
    api.getSessionEmail.mockResolvedValue(null);

    await expect(responseBody(await POST(request("2028-02-29")))).resolves.toEqual({
      status: 401,
      body: { error: "unauthenticated" },
    });
    expectNoWrite();
  });

  it("관리자가 아니면 403이고 쓰지 않는다", async () => {
    api.isAdminEmail.mockReturnValue(false);

    await expect(responseBody(await POST(request("2028-02-29")))).resolves.toEqual({
      status: 403,
      body: { error: "forbidden" },
    });
    expectNoWrite();
  });

  it.each(["2026-02-31", "2026-13-01"])(
    "달력상 존재하지 않는 날짜 %s는 400이고 ensure/write를 호출하지 않는다",
    async (invalidDate) => {
      await expect(responseBody(await POST(request(invalidDate)))).resolves.toEqual({
        status: 400,
        body: {
          error: "invalid_date",
          hint: "YYYY-MM-DD 형식으로 입력해 주세요.",
        },
      });
      expectNoWrite();
    },
  );
});
