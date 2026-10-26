/** GET = 비서 사서함 목록 (newest first, 90 days) and the unread count for the menu dot. */
import { NextResponse } from "next/server";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { isPushEligible } from "@/service/push";
import { getInbox } from "@/service/push-inbox";
import { todayKST } from "@/util/week";
import { inboxRoute, noStore } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  return inboxRoute(async (email, viewingOther) =>
    NextResponse.json(await getInbox(email, { eligible: await isPushEligible(email), viewingOther, today: todayKST() }), noStore));
}
export const GET = withApiTiming("api/inbox:GET", get);
