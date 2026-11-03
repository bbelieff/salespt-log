/** 통화 정리 API — 다른 사이트·남의 계정 조회 중에는 못 쓰고, 기능 오류는 짧은 문구·상태로. */
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireStudentViewContext: vi.fn(), getWritableUserEmail: vi.fn() }));
const svc = vi.hoisted(() => ({ startCall: vi.fn(), listLeadCalls: vi.fn(), uploadCall: vi.fn() }));
const sheet = vi.hoisted(() => ({ resolveDbSheetContext: vi.fn() }));
vi.mock("@/auth/identity", () => ({ ...auth, StudentViewContextError: class extends Error {} }));
vi.mock("@/service/db-sheet", () => ({ ...sheet, DbSheetUnavailable: class extends Error {} }));
vi.mock("@/service/call-summary", async (orig) => ({ ...(await orig<typeof import("@/service/call-summary")>()), ...svc }));

import { CallSummaryError } from "@/service/call-summary";
import { POST } from "@/app/api/calls/route";
import { POST as UPLOAD } from "@/app/api/calls/[id]/upload/route";

const LEAD = "00000000-0000-4000-8000-000000000002";
const req = (headers: Record<string, string> = {}) => new NextRequest("https://fixture.test/api/calls", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://fixture.test", ...headers }, body: JSON.stringify({ leadId: LEAD }),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", "");
  auth.requireStudentViewContext.mockResolvedValue({ email: "caller@example.test" });
  auth.getWritableUserEmail.mockResolvedValue("caller@example.test");
  svc.startCall.mockResolvedValue("call-id");
  sheet.resolveDbSheetContext.mockResolvedValue({ spreadsheetId: "sheet-synthetic" });
});

it("📞 기록 → id", async () => {
  const r = await POST(req());
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ id: "call-id" });
  expect(svc.startCall).toHaveBeenCalledWith({ email: "caller@example.test", spreadsheetId: "sheet-synthetic" }, LEAD);
});

it("다른 사이트·남의 계정 조회 중이면 403, 아무것도 만들지 않는다", async () => {
  expect((await POST(req({ origin: "https://attacker.test" }))).status).toBe(403);
  auth.getWritableUserEmail.mockResolvedValue("admin@example.test");
  expect((await POST(req())).status).toBe(403);
  expect(svc.startCall).not.toHaveBeenCalled();
});

it("기능 오류는 그 상태와 짧은 문구, 형식이 틀리면 400", async () => {
  svc.startCall.mockRejectedValue(new CallSummaryError("없는 기능이에요", 404));
  const r = await POST(req());
  expect(r.status).toBe(404);
  expect(await r.json()).toEqual({ error: "없는 기능이에요" });
  const bad = new NextRequest("https://fixture.test/api/calls/x/upload", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
  expect((await UPLOAD(bad, { params: Promise.resolve({ id: LEAD }) })).status).toBe(400);
  expect(svc.uploadCall).not.toHaveBeenCalled();
});
