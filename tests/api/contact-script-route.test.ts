import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionEmail, getContactScript, saveContactScript, resetContactScript } = vi.hoisted(() => ({
  getSessionEmail: vi.fn(), getContactScript: vi.fn(), saveContactScript: vi.fn(), resetContactScript: vi.fn(),
}));
vi.mock("@/auth/identity", () => ({ getSessionEmail }));
vi.mock("@/service", () => ({ getContactScript, saveContactScript, resetContactScript }));
vi.mock("@/lib/analytics/api-timing", () => ({ withApiTiming: (_l: string, h: unknown) => h }));

import { DELETE, GET, PUT } from "@/app/api/contact-script/route";

const put = (body: unknown) => new Request("http://x/api/contact-script", { method: "PUT", body: JSON.stringify(body) });

describe("/api/contact-script", () => {
  beforeEach(() => { vi.clearAllMocks(); getSessionEmail.mockResolvedValue("me@example.test"); });

  it("로그인 안 하면 401 — 읽지도 쓰지도 않음", async () => {
    getSessionEmail.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(put({ script: "a", sms: "b" }))).status).toBe(401);
    expect(getContactScript).not.toHaveBeenCalled();
    expect(saveContactScript).not.toHaveBeenCalled();
  });
  it("늘 세션 이메일 본인 것만 — 몸통의 email 은 무시", async () => {
    saveContactScript.mockResolvedValue({ script: "a", sms: "b", custom: true });
    const res = await PUT(put({ script: "a", sms: "b", email: "other@example.test" }));
    expect(res.status).toBe(200);
    expect(saveContactScript).toHaveBeenCalledWith("me@example.test", { script: "a", sms: "b" });
    resetContactScript.mockResolvedValue({ script: "d", sms: "d", custom: false });
    await DELETE();
    expect(resetContactScript).toHaveBeenCalledWith("me@example.test");
  });
  it("형식이 틀리거나 너무 길면 400, DB 실패는 503", async () => {
    expect((await PUT(put({ script: 1 }))).status).toBe(400);
    expect((await PUT(put({ script: "x".repeat(20_001), sms: "" }))).status).toBe(400);
    getContactScript.mockRejectedValue(new Error("contact_script_unavailable"));
    expect((await GET()).status).toBe(503);
  });
});
