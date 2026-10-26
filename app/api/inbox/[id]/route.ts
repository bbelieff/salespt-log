/** GET = one summary. Opening it marks it read (not while viewing someone else's screen). */
import { NextRequest, NextResponse } from "next/server";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { openInboxReport } from "@/service/push-inbox";
import { inboxRoute, noStore } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return inboxRoute(async (email, viewingOther) => {
    const report = /^[0-9a-f-]{36}$/i.test(id) ? await openInboxReport(email, id, viewingOther) : null;
    return report ? NextResponse.json({ report }, noStore) : NextResponse.json({ error: "요약을 찾지 못했어요." }, { status: 404 });
  });
}
export const GET = withApiTiming("api/inbox/[id]:GET", get);
