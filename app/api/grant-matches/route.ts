/** GET /api/grant-matches — 지금 보는 수강생의 계약 업체별 맞는 정책공고(맞춤공고 4단계, 읽기 전용). */
import { NextResponse } from "next/server";
import { requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { loadGrantMatches } from "@/service/grant-matches";
import { todayKST } from "@/util/week";
import { withApiTiming } from "@/lib/analytics/api-timing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function get() {
  try {
    const view = await requireStudentViewContext();
    return NextResponse.json(await loadGrantMatches(view.email, todayKST(), view.sheetOverride), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && error.message.startsWith("[no-sheet]")) return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    return NextResponse.json({ error: "맞는 공고를 불러오지 못했어요." }, { status: 503 });
  }
}
export const GET = withApiTiming("api/grant-matches:GET", get);
