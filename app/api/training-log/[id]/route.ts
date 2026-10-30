/** GET = 트레이닝일지 한 편 — 내 기수 DB 의 내 행일 때만. 아니면 404(있는지도 알리지 않음). */
import { NextResponse, type NextRequest } from "next/server";
import { resolveStudentViewContext } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { getMyTrainingLog } from "@/service/training-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await resolveStudentViewContext();
  if (!context.ok) return NextResponse.json({ error: context.code }, { status: context.status });
  const { id } = await params;
  try {
    const log = await getMyTrainingLog(context.email, id);
    if (!log) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(log, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
export const GET = withApiTiming("api/training-log/[id]:GET", get);
