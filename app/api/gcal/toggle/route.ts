/**
 * POST /api/gcal/toggle — 일정별 개별 토글(gcal-2b). {kind, id, on}.
 * on=true 담기 / on=false 빼기. 미연결이면 409(not_connected) → UI "먼저 연결" 유도.
 * **본인만**(fix/gcal-per-user-identity) — 임퍼스네이션 403(수강생 캘린더 조작 금지).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { toggleGcalSchedule } from "@/service/gcal-connect";

const Body = z.object({
  kind: z.enum(["meeting", "todo"]),
  id: z.string().min(1),
  on: z.boolean(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = gcalActorFrom(session, await getActiveUserEmail());
  if (actor.impersonated) return NextResponse.json({ error: "self_only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { kind, id, on } = parsed.data;
  const res = await toggleGcalSchedule(actor.email, kind, id, on);
  if (!res.connected) return NextResponse.json({ error: "not_connected" }, { status: 409 });
  const r = NextResponse.json({ ok: true, on });
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
