/**
 * POST /api/gcal/states — 캘린더 항목별 토글 초기 상태 배치 조회(gcal-2b).
 * {meetingIds[], todoIds[]} → {connected, states:{id:담김여부}}. 미연결이면 connected:false.
 * 표시는 **화면의 수강생(active)** 기준(fix/gcal-per-user-identity) — 읽기라 임퍼스네이션 허용.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { loadGcalToggleStates } from "@/service/gcal-connect";

const Body = z.object({
  meetingIds: z.array(z.string()).default([]),
  todoIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = gcalActorFrom(session, await getActiveUserEmail());
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const res = await loadGcalToggleStates(actor.email, parsed.data.meetingIds, parsed.data.todoIds);
  const r = NextResponse.json(res);
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
