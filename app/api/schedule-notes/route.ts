/**
 * /api/schedule-notes — 일정·계약 탭 주간 보드의 일별 메모·주간 이슈.
 * GET ?from=YYYY-MM-DD&issuesWeek=YYYY-MM-DD[&days=1~42] → { memos, issues } (from 부터 days 일(기본 7) 메모 + 그 수강 주 이슈)
 *   days 는 한 달 보드(달력 6줄 = 42일)가 쓴다.
 * PUT { kind:"memo", date, text } | { kind:"issues", weekStart, issues } → { ok }
 * 대상은 보고 있는 수강생(트레이너 대리 보기 포함), 쓰기는 쓰기 권한이 있을 때만. 표가 아직 없으면 503.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getScheduleNotes, saveScheduleNote } from "@/service";
import { getWritableUserEmail, requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { ScheduleNotePut } from "@/types";
import { addDays, fmtISO, parseISO } from "@/util/week";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Days = z.coerce.number().int().min(1).max(42).default(7);

function fail(e: unknown) {
  if (e instanceof StudentViewContextError) return NextResponse.json({ error: e.code, code: e.code }, { status: e.status });
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

async function GET_handler(req: NextRequest) {
  const from = IsoDate.safeParse(req.nextUrl.searchParams.get("from"));
  const week = IsoDate.safeParse(req.nextUrl.searchParams.get("issuesWeek"));
  const days = Days.safeParse(req.nextUrl.searchParams.get("days") ?? undefined);
  if (!from.success || !week.success || !days.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const context = await requireStudentViewContext();
    const start = parseISO(from.data);
    const dates = Array.from({ length: days.data }, (_, i) => fmtISO(addDays(start, i)));
    return NextResponse.json(await getScheduleNotes(context.email, dates, week.data), { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}

async function PUT_handler(req: NextRequest) {
  const parsed = ScheduleNotePut.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const context = await requireStudentViewContext();
    const writable = await getWritableUserEmail();
    if (writable.toLowerCase() !== context.email.toLowerCase()) {
      return NextResponse.json({ error: "invalid_student_target", code: "invalid_student_target" }, { status: 403 });
    }
    await saveScheduleNote(context.email, parsed.data);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return fail(e);
  }
}

export const GET = withApiTiming("api/schedule-notes:GET", GET_handler);
export const PUT = withApiTiming("api/schedule-notes:PUT", PUT_handler);
