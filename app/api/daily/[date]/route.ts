/**
 * GET  /api/daily/:date  → ContactDayView (4채널 4지표 + 미팅)
 * POST /api/daily/:date  → 4지표 4채널 저장
 *
 * SSOT: docs/domains/data-model.md API 엔드포인트
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Channel } from "@/types";
import { loadDay, saveContactMetrics } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

const MetricsBody = z.record(
  Channel,
  z.object({
    production: z.number().int().nonnegative(),
    inflow: z.number().int().nonnegative(),
    contactProgress: z.number().int().nonnegative(),
    contactSuccess: z.number().int().nonnegative(),
  }),
);

interface RouteContext {
  params: Promise<{ date: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { date } = await ctx.params;
    const parsed = DateParam.safeParse(date);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = getCurrentUserEmail();
    const view = await loadDay(email, parsed.data);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { date } = await ctx.params;
    const dateParsed = DateParam.safeParse(date);
    if (!dateParsed.success) {
      return NextResponse.json(
        { error: dateParsed.error.message },
        { status: 400 },
      );
    }
    const body = await req.json();
    const bodyParsed = MetricsBody.safeParse(body);
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: bodyParsed.error.message },
        { status: 400 },
      );
    }
    const email = getCurrentUserEmail();
    await saveContactMetrics(email, dateParsed.data, bodyParsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
