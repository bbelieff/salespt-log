/** GET = 로그인한(또는 지금 보고 있는) 수강생의 트레이닝일지 목록 — 노션에서 자기 것만. */
import { NextResponse } from "next/server";
import { resolveStudentViewContext } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { listMyTrainingLogs } from "@/service/training-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  const context = await resolveStudentViewContext();
  if (!context.ok) return NextResponse.json({ error: context.code }, { status: context.status });
  return NextResponse.json(await listMyTrainingLogs(context.email), { headers: { "Cache-Control": "no-store" } });
}
export const GET = withApiTiming("api/training-log:GET", get);
