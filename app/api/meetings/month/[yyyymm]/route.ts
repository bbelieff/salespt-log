/**
 * GET /api/meetings/month/:yyyymm  → CalendarMonthView
 *   - yyyymm 형식: "YYYY-MM" (예: 2026-04)
 *   - 한 달치 미팅을 미팅날짜 기준으로 조회 (1 sheet read)
 *   - 캘린더 탭(/calendar)이 사용
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadMonthMeetings } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const Param = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");

interface RouteContext {
  params: Promise<{ yyyymm: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { yyyymm } = await ctx.params;
    const parsed = Param.safeParse(yyyymm);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = getCurrentUserEmail();
    const view = await loadMonthMeetings(email, parsed.data);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
