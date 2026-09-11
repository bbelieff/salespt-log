import { NextRequest, NextResponse } from "next/server";
import { loadWeeklyGoals, updateWeeklyGoals } from "@/service/weekly-goals";
import { goalResponse, goalWriteAllowed } from "./response";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  return goalResponse(() => loadWeeklyGoals(req.nextUrl.searchParams));
}
export async function PUT(req: NextRequest) {
  if (!goalWriteAllowed(req)) return NextResponse.json({ error: "요청 출처를 확인해 주세요." }, { status: 403 });
  return goalResponse(async () => updateWeeklyGoals(req.nextUrl.searchParams, await req.json()));
}
