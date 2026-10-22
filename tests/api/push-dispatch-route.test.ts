/** web-push-notifications §5 — 발송 시계는 서버 안에서 비밀 헤더로만 부른다(Caddy 경유 거절). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dispatchDuePush = vi.fn(async () => ({ tick: "2026-10-23 08:45", candidates: 0, sent: 0, skippedZero: 0, failed: 0, duplicate: 0 }));
vi.mock("@/service/push", () => ({ dispatchDuePush: () => dispatchDuePush() }));
const { POST } = await import("@/app/api/internal/push/dispatch/route");

const SECRET = "s".repeat(40);
const req = (headers: Record<string, string>) => new NextRequest("http://127.0.0.1:3000/api/internal/push/dispatch", { method: "POST", headers });

beforeEach(() => { dispatchDuePush.mockClear(); process.env.PUSH_CRON_SECRET = SECRET; });

describe("POST /api/internal/push/dispatch", () => {
  it("runs with the local secret, with or without the loopback X-Forwarded-For next start adds", async () => {
    expect((await POST(req({ "x-push-cron": SECRET }))).status).toBe(200);
    expect((await POST(req({ "x-push-cron": SECRET, "x-forwarded-for": "127.0.0.1" }))).status).toBe(200);
    expect((await POST(req({ "x-push-cron": SECRET, "x-forwarded-for": "::ffff:127.0.0.1" }))).status).toBe(200);
    expect(dispatchDuePush).toHaveBeenCalledTimes(3);
  });
  it("hides itself for a wrong secret, a request through Caddy, or a missing/short secret", async () => {
    expect((await POST(req({ "x-push-cron": "nope" }))).status).toBe(404);
    expect((await POST(req({ "x-push-cron": SECRET, "x-forwarded-for": "1.2.3.4" }))).status).toBe(404);
    expect((await POST(req({ "x-push-cron": SECRET, "x-forwarded-for": "127.0.0.1, 1.2.3.4" }))).status).toBe(404);
    process.env.PUSH_CRON_SECRET = "short";
    expect((await POST(req({ "x-push-cron": "short" }))).status).toBe(404);
    expect(dispatchDuePush).not.toHaveBeenCalled();
  });
});
