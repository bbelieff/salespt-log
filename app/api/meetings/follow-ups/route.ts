import { NextRequest, NextResponse } from "next/server";
import { requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { loadFollowUpMeetings } from "@/service/meeting-follow-ups";
import { DbSheetDate } from "@/types/db-sheet";
import { todayKST } from "@/util/week";
import { withApiTiming } from "@/lib/analytics/api-timing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function get(req: NextRequest) {
  try {
    const view = await requireStudentViewContext();
    const date = DbSheetDate.safeParse(req.nextUrl.searchParams.get("through") ?? todayKST());
    if (!date.success) return NextResponse.json({ error: "날짜를 확인해 주세요." }, { status: 400 });
    return NextResponse.json({ meetings: await loadFollowUpMeetings(view.email, date.data, view.sheetOverride) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && error.message.startsWith("[no-sheet]")) return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    return NextResponse.json({ error: "미팅 목록을 불러오지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
  }
}
export const GET = withApiTiming("api/meetings/follow-ups:GET", get);
