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
import {
  requireStudentViewContext,
  getWritableUserEmail,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

const MetricsBody = z.record(
  Channel,
  z.object({
    production: z.number().int().nonnegative(),
    inflow: z.number().int().nonnegative(),
    contactProgress: z.number().int().nonnegative(),
    meetingReservation: z.number().int().nonnegative(),
  }),
);

interface RouteContext {
  params: Promise<{ date: string }>;
}

async function GET_handler(_req: NextRequest, ctx: RouteContext) {
  try {
    const { date } = await ctx.params;
    const parsed = DateParam.safeParse(date);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const context = await requireStudentViewContext();
    const view = await loadDay(context.email, parsed.data);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      e instanceof Error &&
      "code" in e &&
      "status" in e &&
      ["unauthenticated", "invalid_student_target", "student_target_required", "student_view_forbidden"].includes(String(e.code)) &&
      (e.status === 401 || e.status === 403)
    ) {
      const error = e as Error & { code: string; status: number };
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      );
    }
    if (msg.startsWith("[no-sheet]")) {
      // 시트 없는 계정(트레이너 임퍼스네이션 등) — 500 아닌 명시 404 (P1 2026-07-28)
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "student_view_unavailable", code: "student_view_unavailable" },
      { status: 503 },
    );
  }
}

async function POST_handler(req: NextRequest, ctx: RouteContext) {
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
    const context = await requireStudentViewContext();
    const writableEmail = await getWritableUserEmail();
    if (writableEmail.toLowerCase() !== context.email.toLowerCase()) {
      return NextResponse.json(
        { error: "invalid_student_target", code: "invalid_student_target" },
        { status: 403 },
      );
    }
    const result = await saveContactMetrics(context.email, dateParsed.data, bodyParsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      e instanceof Error &&
      "code" in e &&
      "status" in e &&
      ["unauthenticated", "invalid_student_target", "student_target_required", "student_view_forbidden"].includes(String(e.code)) &&
      (e.status === 401 || e.status === 403)
    ) {
      const error = e as Error & { code: string; status: number };
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      );
    }
    if (msg.startsWith("[no-sheet]")) {
      // 시트 없는 계정(트레이너 임퍼스네이션 등) — 500 아닌 명시 404 (P1 2026-07-28)
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "student_view_unavailable", code: "student_view_unavailable" },
      { status: 503 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/daily/[date]:GET", GET_handler);
export const POST = withApiTiming("api/daily/[date]:POST", POST_handler);
