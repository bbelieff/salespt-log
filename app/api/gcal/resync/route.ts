/**
 * POST /api/gcal/resync — [다시 올리기](gcal-2b). 제외 안 한 전체 일정을 구글에 멱등 재푸시.
 * 미연결이면 409. 세션 사용자 본인 대상(impersonation 무시). 항목 많으면 다소 걸릴 수 있음.
 */
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { resyncGcal } from "@/service/gcal-connect";

export async function POST() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const res = await resyncGcal(email);
  if (!res.connected) return NextResponse.json({ error: "not_connected" }, { status: 409 });
  const r = NextResponse.json({ pushed: res.pushed });
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
