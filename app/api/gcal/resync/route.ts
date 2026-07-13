/**
 * POST /api/gcal/resync — [다시 올리기](gcal-2b). 제외 안 한 전체 일정을 구글에 멱등 재푸시.
 * 미연결이면 409. **본인만**(fix/gcal-per-user-identity) — 임퍼스네이션 403.
 */
import { NextResponse } from "next/server";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { resyncGcal } from "@/service/gcal-connect";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler() {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = gcalActorFrom(session, await getActiveUserEmail());
  if (actor.impersonated) return NextResponse.json({ error: "self_only" }, { status: 403 });
  const res = await resyncGcal(actor.email);
  if (!res.connected) return NextResponse.json({ error: "not_connected" }, { status: 409 });
  const r = NextResponse.json({ pushed: res.pushed });
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}

export const POST = withApiTiming("api/gcal/resync:POST", POST_handler);
