/**
 * PATCH  /api/meeting/:id  → 미팅 부분 업데이트
 * DELETE /api/meeting/:id  → 미팅 행 클리어
 */
import { NextRequest, NextResponse } from "next/server";
import { Meeting } from "@/types";
import { patchMeeting, removeMeeting } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = Meeting.omit({ id: true }).partial();

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = getCurrentUserEmail();
    await patchMeeting(email, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const email = getCurrentUserEmail();
    await removeMeeting(email, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
