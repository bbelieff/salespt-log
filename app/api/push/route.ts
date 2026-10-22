/** GET = this person's push state (pilot gate, public key, settings, devices). PUT = save settings. */
import { NextRequest, NextResponse } from "next/server";
import { getActiveUserEmail } from "@/auth/identity";
import { getPushState, savePushPreferences } from "@/service/push";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { noStore, pushRoute } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  return pushRoute(async email => {
    const viewing = await getActiveUserEmail().catch(() => email);
    return NextResponse.json(await getPushState(email, viewing.toLowerCase() !== email.toLowerCase()), noStore);
  });
}
async function put(req: NextRequest) {
  return pushRoute(async email => NextResponse.json({ preferences: await savePushPreferences(email, await req.json()) }, noStore));
}
export const GET = withApiTiming("api/push:GET", get);
export const PUT = withApiTiming("api/push:PUT", put);
