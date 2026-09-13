import { beforeEach, expect, it, vi } from "vitest";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";
const m = vi.hoisted(() => ({ admin: true, status: "active", setting: null as null | { grade: string; grants: unknown; version: number }, save: vi.fn() }));
vi.mock("@/auth/identity", () => ({ getSessionEmail: async () => "admin@example.test", isAdminEmail: () => m.admin }));
vi.mock("@/repo/db/trainer-access-settings", () => ({
  listTrainerAccessRows: async () => [{ qualification: { email: "coach@example.test", name: "합성", status: m.status }, setting: m.setting }],
  withTrainerAccessLock: async (_email: string, work: (tx: unknown) => Promise<void>) => work({
    qualification: { email: "coach@example.test", name: "합성", status: m.status }, read: async () => m.setting, save: m.save,
  }),
}));
import { GET, PUT } from "@/app/api/admin/trainer-access/route";
const grants = () => ({ ...defaultTrainerGrants("regular"), active: { read: true, write: false } });
const put = (version: number) => PUT(new Request("https://app.example.test/api/admin/trainer-access", { method: "PUT", headers: { origin: "https://app.example.test", "content-type": "application/json" }, body: JSON.stringify({ email: "coach@example.test", grade: "regular", grants: grants(), version }) }));
beforeEach(() => {
  vi.stubEnv("AUTH_URL", "https://app.example.test"); m.admin = true; m.status = "active";
  m.setting = { grade: "senior", grants: defaultTrainerGrants("senior"), version: 2 };
  m.save.mockReset().mockImplementation(async (input, actor) => { expect(actor).toBe("admin@example.test"); m.setting = { ...input, version: input.version + 1 }; return true; });
});
it("real API/service saves reduced grade grants, reads back and rejects stale CAS", async () => {
  expect((await put(2)).status).toBe(200);
  expect((await (await GET()).json()).trainers[0]).toMatchObject({ grade: "regular", grants: grants(), version: 3 });
  expect((await put(2)).status).toBe(409); expect(m.save).toHaveBeenCalledOnce();
});
it.each(["pending", "revoked", "cancelled", "rejected"])("only active qualifications are listed/saved: %s", async status => {
  m.status = status; expect(await (await GET()).json()).toEqual({ trainers: [] }); expect((await put(2)).status).toBe(403); expect(m.save).not.toHaveBeenCalled();
});
it("management/nonadmin receives no API data or mutation", async () => {
  m.admin = false; expect((await GET()).status).toBe(403); expect((await put(2)).status).toBe(403); expect(m.save).not.toHaveBeenCalled();
});
