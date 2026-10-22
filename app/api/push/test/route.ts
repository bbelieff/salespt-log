/** POST = send one test notification to this person's own devices (3 per day). */
import { NextResponse } from "next/server";
import { sendTestPush } from "@/service/push";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { noStore, pushRoute } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { limit: 429, no_device: 409, not_configured: 503, send_failed: 502 } as const;
async function post() {
  return pushRoute(async email => {
    const r = await sendTestPush(email);
    return NextResponse.json(r, { ...noStore, status: r.ok ? 200 : STATUS[r.reason] });
  });
}
export const POST = withApiTiming("api/push/test:POST", post);
