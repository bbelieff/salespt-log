import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), query: vi.fn(), connect: vi.fn(), release: vi.fn() }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: mocks.enabled, getDbPool: () => ({ query: mocks.query, connect: mocks.connect }) }));
import { listTrainerAccessRows, withTrainerAccessLock } from "@/repo/db/trainer-access-settings";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";
beforeEach(() => {
  vi.resetAllMocks(); mocks.enabled.mockReturnValue(true);
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
});
it("missing DB throws rather than returning a successful empty list", async () => {
  mocks.enabled.mockReturnValue(false); await expect(listTrainerAccessRows()).rejects.toThrow(); expect(mocks.query).not.toHaveBeenCalled();
});
it("locks exact qualification, commits and releases", async () => {
  await withTrainerAccessLock("one@example.test", async tx => { expect(tx.qualification).toBeNull(); await tx.read(); });
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("where email = $1 for share"), ["one@example.test"]);
  expect(mocks.query).toHaveBeenLastCalledWith("commit"); expect(mocks.release).toHaveBeenCalledOnce();
});
it("rollback and release on validation failure", async () => {
  await expect(withTrainerAccessLock("one@example.test", async () => { throw new Error("denied"); })).rejects.toThrow("denied");
  expect(mocks.query).toHaveBeenLastCalledWith("rollback"); expect(mocks.release).toHaveBeenCalledOnce();
});
it("parameters contain only the locked key, complete grants, version and actor", async () => {
  const input = { email: "one@example.test", grade: "regular" as const, grants: defaultTrainerGrants("regular"), version: 3 };
  await withTrainerAccessLock(input.email, async tx => {
    expect(await tx.save(input, "admin@example.test")).toBe(false);
    await expect(tx.save({ ...input, email: "other@example.test" }, "admin@example.test")).rejects.toThrow();
  });
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("insert into public.trainer_access_audit"),
    [input.email, input.grade, JSON.stringify(input.grants), 3, "admin@example.test"]);
});
