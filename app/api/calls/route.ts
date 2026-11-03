/**
 * 통화 정리(plan call-summary PR-4). POST {leadId} — DB관리시트 📞 를 누른 기록(dialed) → {id}.
 * GET ?leadId= — 그 업체의 내 통화, 최근 것부터. 스위치(CALL_SUMMARY_EMAILS) 밖이면 404.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { listLeadCalls, startCall } from "@/service/call-summary";
import { callResponse } from "./response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest) => callResponse(req, true, async (who) => {
  const { leadId } = z.object({ leadId: z.string().uuid() }).parse(await req.json());
  return { id: await startCall(who, leadId) };
});

export const GET = (req: NextRequest) => callResponse(req, false, async (who) => {
  const leadId = z.string().uuid().parse(req.nextUrl.searchParams.get("leadId"));
  return { calls: await listLeadCalls(who, leadId) };
});
