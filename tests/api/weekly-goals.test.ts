import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ loadWeeklyGoals: vi.fn(), updateWeeklyGoals: vi.fn(), loadWeeklyGoalInternal: vi.fn(), updateWeeklyGoalInternal: vi.fn(), listGoalStudents: vi.fn() }));
vi.mock("@/service/weekly-goals", () => ({ ...m, WeeklyGoalError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { WeeklyGoalError } from "@/service/weekly-goals";
import { GET, PUT } from "@/app/api/weekly-goals/route";
import { GET as internalGET, PUT as internalPUT } from "@/app/api/weekly-goals/internal/route";
import { GET as studentsGET } from "@/app/api/weekly-goals/students/route";

const url = "https://fixture.test/api/weekly-goals?week=2&student=fixture%40example.test&enrollment=fixture";
const request = (headers: Record<string, string> = {}, body = "{}") => new NextRequest(url, { method: "PUT", headers: { "content-type": "application/json", origin: "https://fixture.test", ...headers }, body });
beforeEach(() => {
  vi.resetAllMocks();
  m.loadWeeklyGoals.mockResolvedValue({ current: { record: { revision: 1 } } });
  m.updateWeeklyGoals.mockResolvedValue({ revision: 2 });
  m.loadWeeklyGoalInternal.mockResolvedValue({ specialNotes: "synthetic private" });
  m.updateWeeklyGoalInternal.mockResolvedValue({ revision: 3 });
  m.listGoalStudents.mockResolvedValue([]);
});

describe("weekly goal API transport", () => {
  it("marks public and private authenticated responses no-store", async () => {
    for (const response of [await GET(new NextRequest(url)), await internalGET(new NextRequest(url)), await studentsGET()]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });
  it("passes explicit target/week query to the common service", async () => {
    await GET(new NextRequest(url));
    const p = m.loadWeeklyGoals.mock.calls[0]?.[0] as URLSearchParams;
    expect(p.get("week")).toBe("2");
    expect(p.get("student")).toBe("fixture@example.test");
  });
  it.each<Record<string, string>>([
    { origin: "https://attacker.test" },
    { "sec-fetch-site": "cross-site" },
    { "content-type": "text/plain" },
  ])("rejects forged write headers %j on both public and private routes", async headers => {
    expect((await PUT(request(headers))).status).toBe(403);
    expect((await internalPUT(request(headers))).status).toBe(403);
    expect(m.updateWeeklyGoals).not.toHaveBeenCalled();
    expect(m.updateWeeklyGoalInternal).not.toHaveBeenCalled();
  });
  it("accepts same-origin JSON and returns only committed revision", async () => {
    const response = await PUT(request({}, JSON.stringify({ revision: 1, task: "fixture" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 2 });
    expect(m.updateWeeklyGoals).toHaveBeenCalledWith(expect.any(URLSearchParams), { revision: 1, task: "fixture" });
  });
  it("returns safe 400 for malformed JSON without calling persistence", async () => {
    const response = await PUT(request({}, "{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "입력을 확인해 주세요." });
    expect(m.updateWeeklyGoals).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 422])("preserves typed domain status %s and no-store", async status => {
    m.loadWeeklyGoals.mockRejectedValue(new WeeklyGoalError(status, "safe fixture message"));
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "safe fixture message" });
  });
  it("redacts infrastructure failures instead of exposing secrets or returning success", async () => {
    m.updateWeeklyGoals.mockRejectedValue(new Error("postgres://db.invalid/private fixture-auth-error student@example.test"));
    const response = await PUT(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toMatch(/postgres|fixture-auth-error|student@example/);
  });
  it("applies the same safe failure contract to private records and roster", async () => {
    m.loadWeeklyGoalInternal.mockRejectedValue(new Error("PRIVATE-FIXTURE"));
    m.listGoalStudents.mockRejectedValue(new Error("PRIVATE-FIXTURE"));
    for (const response of [await internalGET(new NextRequest(url)), await studentsGET()]) {
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain("PRIVATE-FIXTURE");
    }
  });
});
