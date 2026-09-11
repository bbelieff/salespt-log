import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), list: vi.fn(), lock: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/auth/identity", () => ({ getSessionEmail: mocks.actor, isAdminEmail: mocks.admin }));
vi.mock("@/repo/db/trainer-access-settings", () => ({
  listTrainerAccessRows: mocks.list, withTrainerAccessLock: mocks.lock,
}));
import { listTrainerAccessSettings, saveTrainerAccessSettings } from "@/service/trainer-access-settings";
const qualification = { email: "trainer@example.test", name: "동명이인", status: "active" };
const command = (grade = "senior") => ({ email: qualification.email, grade, grants: defaultTrainerGrants(grade), version: 0 });
beforeEach(() => {
  vi.resetAllMocks(); mocks.actor.mockResolvedValue("admin@example.test"); mocks.admin.mockReturnValue(true);
  mocks.read.mockResolvedValue(null); mocks.save.mockResolvedValue(true);
  mocks.list.mockResolvedValue([{ qualification, setting: null }]);
  mocks.lock.mockImplementation(async (_email, fn) => fn({ qualification, read: mocks.read, save: mocks.save }));
});
describe("admin trainer access service", () => {
  it("unclassified active trainer has no implicit grade or grants", async () => {
    expect(await listTrainerAccessSettings()).toEqual([{ ...qualification, grade: null, grants: defaultTrainerGrants(null), version: 0 }]);
  });
  it.each([null, "viewer@example.test"])("rejects unauthenticated/nonadmin %s", async (email) => {
    mocks.actor.mockResolvedValue(email); mocks.admin.mockReturnValue(false);
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 403 });
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 403 });
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.lock).not.toHaveBeenCalled();
  });
  it("auth failure closes access", async () => {
    mocks.actor.mockRejectedValue(new Error("private auth failure"));
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 503 });
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each(["pending", "revoked", "unknown"])("rejects qualification %s", async (status) => {
    mocks.lock.mockImplementation(async (_email, fn) => fn({ qualification: { ...qualification, status }, read: mocks.read, save: mocks.save }));
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 403 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...command(), name: "trusted?" }, { ...command(), grade: null }, { ...command(), grade: "super" },
    { ...command(), grants: {} }, { ...command(), version: -1 }, { ...command(), version: 1.5 },
    { ...command(), grants: { ...defaultTrainerGrants("senior"), active: { read: false, write: true } } },
    { ...command("regular"), grants: defaultTrainerGrants("senior") },
  ])("rejects malformed or over-ceiling payload %#", async (input) => {
    await expect(saveTrainerAccessSettings(input)).rejects.toMatchObject({ status: 400 });
    expect(mocks.lock).not.toHaveBeenCalled();
  });
  it("grade downgrade resets defaults and uses authenticated audit actor", async () => {
    mocks.read.mockResolvedValue({ grade: "senior", grants: defaultTrainerGrants("senior"), version: 2 });
    await saveTrainerAccessSettings({ ...command("regular"), grants: defaultTrainerGrants(null), version: 2 });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ grade: "regular", grants: defaultTrainerGrants("regular"), version: 2 }), "admin@example.test");
  });
  it("same-grade read-only edit is retained", async () => {
    mocks.read.mockResolvedValue({ ...command(), version: 2 });
    const grants = defaultTrainerGrants("senior"); grants.arena.write = false;
    await saveTrainerAccessSettings({ ...command(), grants, version: 2 });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ grants }), "admin@example.test");
  });
  it("stale and concurrent writes return conflict", async () => {
    mocks.read.mockResolvedValue({ ...command(), version: 2 });
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 409 });
    mocks.read.mockResolvedValue(null); mocks.save.mockResolvedValue(false);
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 409 });
  });
  it("does not accept a different account from adapter", async () => {
    mocks.lock.mockImplementation(async (_email, fn) => fn({ qualification: { ...qualification, email: "other@example.test" }, read: mocks.read }));
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 503 });
  });
  it("DB failure does not expose underlying details", async () => {
    mocks.list.mockRejectedValue(new Error("connection secret"));
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 503, message: "권한 설정을 불러오거나 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  });
  it.each([null, "pending", "inactive"])("missing/inactive qualification never saves: %s", async status => {
    mocks.lock.mockImplementation(async (_email, fn) => fn({ qualification: status ? { ...qualification, status } : null, read: mocks.read, save: mocks.save }));
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 403 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([
    { grade: null, grants: defaultTrainerGrants("senior"), version: 1 },
    { grade: "regular", grants: defaultTrainerGrants("senior"), version: 1 },
    { grade: "senior", grants: null, version: 1 },
    { grade: "senior", grants: defaultTrainerGrants("senior"), version: 0 },
  ])("stored corruption is unavailable, never repaired to defaults %#", async setting => {
    mocks.list.mockResolvedValue([{ qualification, setting }]);
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 503 });
    mocks.read.mockResolvedValue(setting);
    await expect(saveTrainerAccessSettings(command())).rejects.toMatchObject({ status: 503 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects duplicate keys or untrustworthy server display metadata", async () => {
    mocks.list.mockResolvedValue([{ qualification, setting: null }, { qualification, setting: null }]);
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 503 });
    mocks.list.mockResolvedValue([{ qualification: { ...qualification, name: "" }, setting: null }]);
    await expect(listTrainerAccessSettings()).rejects.toMatchObject({ status: 503 });
  });
});
