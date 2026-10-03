/**
 * POST /api/db/:channel → append (channel = 매입DB | 직접생산 | 현수막 | 콜·지·기·소)
 *
 * 응답: { ok: true, row: number, idempotent: boolean, replayed: boolean }
 *  · idempotent=false — keyless legacy path only: executed exactly like
 *    before; a lost-ACK retry may duplicate. Never claims dedup it cannot
 *    enforce. A PROVIDED key is never downgraded here: with the DB available
 *    it is durably honored (any cohort); with the DB down the request is
 *    rejected BEFORE any side effect as 503 db_idempotency_unavailable and
 *    the client retains the draft for a safe same-key retry.
 *  · idempotent=true — the key scoped to the authenticated owner's
 *    spreadsheet: same key+payload replays the first row, same key+different
 *    payload ⇒ 409 { error, row } (never the stale original, never overwrite).
 *
 * 응답: 409 { error: "db_idempotency_conflict", row? } — row (own scope only)
 * lets the client PATCH the original instead of appending again.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import {
  addBanner,
  addLead,
  addProduction,
  addPurchase,
} from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { normalizeIdempotencyKey } from "@/repo/db/idempotency-keys";
import {
  DB_ENTRY_NOT_FOUND,
  DB_IDEMPOTENCY_CONFLICT,
  DB_IDEMPOTENCY_UNAVAILABLE,
} from "@/repo/db/db-append-idempotency";

interface RouteContext {
  params: Promise<{ channel: string }>;
}

function conflictResponse(e: Error): NextResponse {
  const row = (e as Error & { row?: unknown }).row;
  return NextResponse.json(
    typeof row === "number" && Number.isInteger(row)
      ? { error: DB_IDEMPOTENCY_CONFLICT, row }
      : { error: DB_IDEMPOTENCY_CONFLICT },
    { status: 409 },
  );
}

async function POST_handler(req: NextRequest, ctx: RouteContext) {
  try {
    const { channel } = await ctx.params;
    const decoded = decodeURIComponent(channel);
    const body: unknown = await req.json();
    const email = await getWritableUserEmail();
    // Scope B autosave: append-only creates are server-idempotent per
    // Idempotency-Key header (ambiguous ACK retry replays the original row).
    // Body fallback is plucked BEFORE zod parse — the channel schemas strip
    // unknown keys by design, so reading it after parse would silently drop it.
    const rawBodyKey =
      body !== null && typeof body === "object"
        ? (body as Record<string, unknown>).idempotencyKey
        : undefined;
    let idempotencyKey: string | null = null;
    try {
      idempotencyKey =
        normalizeIdempotencyKey(req.headers.get("idempotency-key")) ??
        normalizeIdempotencyKey(rawBodyKey);
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    let result: { row: number; idempotent: boolean; replayed: boolean };
    switch (decoded) {
      case "매입DB": {
        const parsed = DBPurchase.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addPurchase(email, parsed.data, idempotencyKey);
        break;
      }
      case "직접생산": {
        const parsed = DBProduction.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addProduction(email, parsed.data, idempotencyKey);
        break;
      }
      case "현수막": {
        const parsed = DBBanner.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addBanner(email, parsed.data, idempotencyKey);
        break;
      }
      case "콜·지·기·소": {
        // 발굴id 는 서버가 생성·보존 — 클라이언트발 id 를 스키마에서 차단(링크 탈취 방지, lead-chain §4-3).
        const parsed = DBLead.omit({ 발굴id: true }).safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400 },
          );
        }
        result = await addLead(email, parsed.data, idempotencyKey);
        break;
      }
      default:
        return NextResponse.json(
          { error: `알 수 없는 채널: ${decoded}` },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Error && e.message === DB_IDEMPOTENCY_CONFLICT) {
      return conflictResponse(e);
    }
    if (e instanceof Error && e.message === DB_IDEMPOTENCY_UNAVAILABLE) {
      // Fail closed BEFORE any side effect: the draft key needs durable
      // enforcement the DB cannot provide here. The client retains the draft
      // (same key) and the user retries when the DB is back — never an
      // unsafe write, never a "retry" disclaimer over a duplicate.
      return NextResponse.json({ error: DB_IDEMPOTENCY_UNAVAILABLE }, { status: 503 });
    }
    if (e instanceof Error && e.message === DB_ENTRY_NOT_FOUND) {
      return NextResponse.json({ error: DB_ENTRY_NOT_FOUND }, { status: 404 });
    }
    if (e instanceof Error && e.message === "invalid_request") {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/db/[channel]:POST", POST_handler);
