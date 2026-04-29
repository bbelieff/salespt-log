/**
 * GET /api/meetings/week/:weekStart  → ScheduleWeekView
 *   - 7일치 미팅을 미팅날짜(D열) 기준으로 조회 (1 sheet read)
 *   - 일정·계약 탭(/schedule)이 사용
 *
 * SSOT: docs/plans/active/03-meeting-results.md
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadWeekMeetings } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

interface RouteContext {
  params: Promise<{ weekStart: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { weekStart } = await ctx.params;
    const parsed = DateParam.safeParse(weekStart);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }
    const email = getCurrentUserEmail();
    const view = await loadWeekMeetings(email, parsed.data);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
