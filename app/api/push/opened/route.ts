/** POST { d } = the service worker reports that a notification was tapped (plan §4 출처 꼬리표). */
import { NextRequest, NextResponse } from "next/server";
import { markPushOpened } from "@/service/push";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { noStore, pushRoute } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function post(req: NextRequest) {
  return pushRoute(async email => {
    const body = (await req.json().catch(() => ({}))) as { d?: unknown };
    return NextResponse.json({ ok: typeof body.d === "string" && (await markPushOpened(email, body.d)) }, noStore);
  });
}
export const POST = withApiTiming("api/push/opened:POST", post);
