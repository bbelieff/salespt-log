import { NextResponse } from "next/server";
import { requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { loadBadges } from "@/service/badges";
import { todayKST } from "@/util/week";
import { withApiTiming } from "@/lib/analytics/api-timing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function get() {
  try {
    const view = await requireStudentViewContext();
    return NextResponse.json(await loadBadges(view.email, todayKST(), view.sheetOverride), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && error.message.startsWith("[no-sheet]")) return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    return NextResponse.json({ error: "배지를 불러오지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
  }
}
export const GET = withApiTiming("api/badges:GET", get);
