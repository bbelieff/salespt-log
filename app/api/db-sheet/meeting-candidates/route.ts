/**
 * GET /api/db-sheet/meeting-candidates?lead=<id> — 따로 잡은 미팅 연결 후보(2026-10-23 belie).
 * STEP 2 에서 직접 잡아 어느 DB 에도 안 이어진 미팅 중 업체명이 같거나 비슷한 것. 읽기 전용.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { DbSheetUnavailable, resolveDbSheetContext, loadDbSheetMeetingCandidates } from "@/service/db-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const lead = z.string().uuid().safeParse(req.nextUrl.searchParams.get("lead"));
    if (!lead.success) return NextResponse.json({ error: "업체를 찾지 못했어요." }, { status: 400 });
    const view = await requireStudentViewContext();
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    return NextResponse.json({ candidates: await loadDbSheetMeetingCandidates(ctx, lead.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof DbSheetUnavailable) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "미팅 후보를 불러오지 못했어요. 다시 시도해 주세요." }, { status: 503 });
  }
}
