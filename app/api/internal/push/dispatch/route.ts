/**
 * POST — the VPS cron's 15-minute tick (plan §5). Only reachable from the server itself:
 * the shared secret must match and the request must not have come through Caddy
 * (Caddy always adds X-Forwarded-For; a local curl to 127.0.0.1:3000 does not).
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dispatchDuePush } from "@/service/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.PUSH_CRON_SECRET?.trim();
  const given = req.headers.get("x-push-cron") ?? "";
  if (!secret || secret.length < 32 || req.headers.has("x-forwarded-for")) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(await dispatchDuePush(), { headers: { "Cache-Control": "no-store" } });
}
