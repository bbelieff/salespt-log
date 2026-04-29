/**
 * GET  /api/payment/:date  → DailyRevenue (없으면 0/0/0/"")
 * POST /api/payment/:date  → 일별 실적 Q~T 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DailyRevenue } from "@/types";
import { loadDailyRevenue, saveDailyRevenue } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

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
    const rev = await loadDailyRevenue(email, parsed.data);
    return NextResponse.json(rev);
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
    // body는 date를 가질 수도 있음 — URL의 date를 권위로 사용
    const merged = { ...body, date: dateParsed.data };
    const parsed = DailyRevenue.safeParse(merged);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = getCurrentUserEmail();
    await saveDailyRevenue(email, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
