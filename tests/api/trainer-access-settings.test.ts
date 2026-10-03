import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/service/trainer-access-settings", async (original) => ({
  ...await original<typeof import("@/service/trainer-access-settings")>(),
  requireTrainerAccessAdmin: mocks.auth, listTrainerAccessSettings: mocks.list, saveTrainerAccessSettings: mocks.save,
}));
vi.mock("@/auth/identity", () => ({ getSessionEmail: vi.fn(), isAdminEmail: vi.fn() }));
import { GET, PUT } from "../../app/api/admin/trainer-access/route";
import { TrainerAccessError } from "@/service/trainer-access-settings";
const url = "https://app.example.test/api/admin/trainer-access";
const request = (headers: Record<string, string> = {}, body = "{}") => new Request(url, { method: "PUT", headers: { origin: "https://app.example.test", "content-type": "application/json", ...headers }, body });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "https://app.example.test"); mocks.auth.mockResolvedValue("admin@example.test"); mocks.list.mockResolvedValue([]); mocks.save.mockResolvedValue(undefined); });
it("GET is uncached and PUT explicitly acknowledges a save", async () => {
  const read = await GET(); expect(read.status).toBe(200); expect(read.headers.get("cache-control")).toContain("no-store");
  expect(await read.json()).toEqual({ trainers: [] }); expect((await PUT(request())).status).toBe(200);
});
it.each<Record<string, string>>([{ origin: "https://evil.test" }, { origin: "null" }, { origin: "" }, { "content-type": "text/plain" }, { "sec-fetch-site": "cross-site" }])("rejects CSRF/content type %#", async (headers) => {
  expect((await PUT(request(headers))).status).toBe(403); expect(mocks.save).not.toHaveBeenCalled();
});
it.each(["{", "x".repeat(4097)])("malformed/oversized body 400 %#", async body => {
  expect((await PUT(request({}, body))).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
});
it.each([400, 403, 409, 503] as const)("maps service %i without leaking errors", async status => {
  mocks.save.mockRejectedValue(new TrainerAccessError(status)); expect((await PUT(request())).status).toBe(status);
});
it("auth exception fails closed before parsing body", async () => {
  mocks.auth.mockRejectedValue(new Error("secret")); const res = await PUT(request({}, "{"));
  expect(res.status).toBe(503); expect(JSON.stringify(await res.json())).not.toContain("secret"); expect(mocks.save).not.toHaveBeenCalled();
});
it("configured origin defeats a forged request URL and malformed config fails closed", async () => {
  const forged = new Request("https://evil.test/api/admin/trainer-access", { method: "PUT", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: "{}" });
  expect((await PUT(forged)).status).toBe(403);
  vi.stubEnv("AUTH_URL", "invalid-origin"); expect((await PUT(request())).status).toBe(403);
});
