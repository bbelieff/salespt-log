/**
 * POST — the VPS cron's 15-minute tick (plan §5). Only reachable from the server itself:
 * the shared secret must match and every X-Forwarded-For hop must be loopback.
 * `next start` stamps X-Forwarded-For with the socket address even for a local curl
 * (127.0.0.1), while a request through Caddy carries the visitor's address, which Caddy
 * sets itself and does not take from the client (2026-10-22 운영 실측).
 */
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { dispatchDuePush } from "@/service/push";
import { dispatchDbSheetFeeds } from "@/service/db-sheet-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function fromThisServer(req: NextRequest): boolean {
  const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return hops.every(h => LOOPBACK.has(h));
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.PUSH_CRON_SECRET?.trim();
  const given = req.headers.get("x-push-cron") ?? "";
  if (!secret || secret.length < 32 || !fromThisServer(req)) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // DB 시트 자동 확인(2026-11-06)도 같은 시계에 붙는다 — 먼저 짧게(25초) 돌고, 남은 연결은 다음 15분에 이어서.
  const feeds = await dispatchDbSheetFeeds().catch((error) => { Sentry.captureException(error, { tags: { where: "db-sheet-feed-dispatch" } }); return null; });
  return NextResponse.json({ ...(await dispatchDuePush()), feeds }, { headers: { "Cache-Control": "no-store" } });
}
