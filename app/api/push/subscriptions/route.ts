/** POST = register this browser for push. DELETE = stop one device ({ id } or { endpoint }). */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { subscribePush, unsubscribePush } from "@/service/push";
import { PushSubscriptionInput } from "@/types/push";
import { withApiTiming } from "@/lib/analytics/api-timing";
import { noStore, pushRoute } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DeviceRef = z.object({ id: z.string().uuid().optional(), endpoint: z.string().url().optional() })
  .refine(r => !!(r.id || r.endpoint), "id or endpoint");

async function post(req: NextRequest) {
  return pushRoute(async email => NextResponse.json({ id: await subscribePush(email, PushSubscriptionInput.parse(await req.json())) }, noStore));
}
async function del(req: NextRequest) {
  return pushRoute(async email => NextResponse.json({ removed: await unsubscribePush(email, DeviceRef.parse(await req.json())) }, noStore));
}
export const POST = withApiTiming("api/push/subscriptions:POST", post);
export const DELETE = withApiTiming("api/push/subscriptions:DELETE", del);
