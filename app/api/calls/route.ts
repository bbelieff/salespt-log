/**
 * 통화 정리(plan call-summary PR-4·5). POST {leadId, calledAt?} — DB관리시트 📞 를 누른 기록(dialed) → {id}.
 * GET ?leadId= — 그 업체의 내 통화, 최근 것부터. GET(업체 없이) — 이 시트의 진행 중 통화(목록 상태 칩).
 * 스위치(CALL_SUMMARY_EMAILS) 밖이면 404 — 화면은 404 면 📞 를 숨긴다.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { listActiveCalls, listLeadCalls, startCall } from "@/service/call-summary";
import { callResponse } from "./response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest) => callResponse(req, true, async (who) => {
  const { leadId, calledAt } = z.object({ leadId: z.string().uuid(), calledAt: z.string().datetime().optional() }).parse(await req.json());
  return { id: await startCall(who, leadId, calledAt) };
});

export const GET = (req: NextRequest) => callResponse(req, false, async (who) => {
  const leadId = req.nextUrl.searchParams.get("leadId");
  return { calls: leadId ? await listLeadCalls(who, z.string().uuid().parse(leadId)) : await listActiveCalls(who) };
});
