import { afterEach, describe, expect, it, vi } from "vitest";
import { GoalRequestError, goalAccessDenied, goalJSON } from "@/components/weekly-goals/client";
import { GoalRequestFence } from "@/components/weekly-goals/requestFence";

afterEach(() => vi.unstubAllGlobals());
describe("goal transport status without trusted response body", () => {
  it.each([401, 403])("retains HTTP%s for non-JSON and empty denial without returning body text", async status => {
    for (const body of ["", "<html>PRIVATE-RESPONSE-TEXT</html>"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
      const error = await goalJSON("/fixture").catch(e => e);
      expect(error).toBeInstanceOf(GoalRequestError);
      if (!(error instanceof GoalRequestError)) throw new Error("Expected typed transport error");
      expect(error.status).toBe(status); expect(goalAccessDenied(error)).toBe(true);
      expect(error.message).not.toContain("PRIVATE-RESPONSE-TEXT");
    }
  });
  it.each([409, 503])("preserves HTTP%s as non-auth failure", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    const error = await goalJSON("/fixture").catch(e => e);
    expect(error).toBeInstanceOf(GoalRequestError);
    if (!(error instanceof GoalRequestError)) throw new Error("Expected typed transport error");
    expect(error.status).toBe(status); expect(goalAccessDenied(error)).toBe(false);
  });
  it("does not turn invalid successful JSON into a saved success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>not JSON</html>")));
    await expect(goalJSON("/fixture", {})).rejects.toMatchObject({ status: 200 });
  });
});
describe("private request fence (even if a transport ignores abort)", () => {
  it("rejects older A200 after latest B403 invalidates all in-flight state", () => {
    const fence = new GoalRequestFence(), a = fence.begin(), b = fence.begin();
    expect(a.signal.aborted).toBe(true); expect(a.current()).toBe(false);
    expect(b.current()).toBe(true);
    fence.cancel();
    expect(a.current()).toBe(false); expect(b.current()).toBe(false);
    const explicitRevalidation = fence.begin();
    expect(explicitRevalidation.current()).toBe(true);
    expect(a.current()).toBe(false);
  });
  it("invalidates initial effect response on unmount and isolates a new mount", () => {
    const old = new GoalRequestFence(), response = old.begin(); old.cancel();
    const next = new GoalRequestFence().begin();
    expect(response.current()).toBe(false); expect(next.current()).toBe(true);
  });
});
