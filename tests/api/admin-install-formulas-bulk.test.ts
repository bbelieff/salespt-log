import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionEmail, isAdminEmail, listAllUsers, installFormulas } =
  vi.hoisted(() => ({
    getSessionEmail: vi.fn(),
    isAdminEmail: vi.fn(),
    listAllUsers: vi.fn(),
    installFormulas: vi.fn(),
  }));

vi.mock("@/auth/identity", () => ({ getSessionEmail, isAdminEmail }));
vi.mock("@/repo/users", () => ({ listAllUsers }));
vi.mock("@/repo/setup-formulas", () => ({ installFormulas }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { POST } from "@/app/api/admin/install-formulas-bulk/route";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("POST /api/admin/install-formulas-bulk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSessionEmail.mockReset().mockResolvedValue("admin@example.com");
    isAdminEmail.mockReset().mockReturnValue(true);
    listAllUsers.mockReset();
    installFormulas.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs at most five installs per wave and waits 7.5 seconds before the next wave", async () => {
    const users = Array.from({ length: 10 }, (_, index) => ({
      email: `trainee${index}@example.com`,
      name: `trainee-${index}`,
      cohort: "A1-1",
      role: "trainee",
      status: "active",
      spreadsheetId: `sheet-${index}`,
    }));
    listAllUsers.mockResolvedValue(users);

    const installs = users.map(() => deferred<{
      installed: number;
      preserved: number;
      preservedCells: string[];
    }>());
    let callIndex = 0;
    installFormulas.mockImplementation(
      () => installs[callIndex++]!.promise,
    );

    const responsePromise = POST();
    await flushMicrotasks();

    expect(installFormulas).toHaveBeenCalledTimes(5);
    expect(installFormulas.mock.calls.map(([sheetId]) => sheetId)).toEqual([
      "sheet-0",
      "sheet-1",
      "sheet-2",
      "sheet-3",
      "sheet-4",
    ]);

    for (let i = 0; i < 5; i++) {
      installs[i]!.resolve({ installed: 3, preserved: 0, preservedCells: [] });
    }
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(7_499);
    expect(installFormulas).toHaveBeenCalledTimes(5);

    await vi.advanceTimersByTimeAsync(1);
    expect(installFormulas).toHaveBeenCalledTimes(10);

    for (let i = 5; i < 10; i++) {
      if (i === 7) installs[i]!.reject(new Error("sheet denied"));
      else installs[i]!.resolve({ installed: 3, preserved: 0, preservedCells: [] });
    }

    const response = await responsePromise;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: 10,
      success: expect.arrayContaining([
        expect.objectContaining({ email: "trainee0@example.com" }),
        expect.objectContaining({ email: "trainee9@example.com" }),
      ]),
      failed: [
        expect.objectContaining({
          email: "trainee7@example.com",
          error: "sheet denied",
        }),
      ],
    });
  });
});
