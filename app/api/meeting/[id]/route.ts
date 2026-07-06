/**
 * PATCH  /api/meeting/:id  → 미팅 부분 업데이트
 * DELETE /api/meeting/:id  → 미팅 행 클리어
 */
import { NextRequest, NextResponse } from "next/server";
import { Meeting } from "@/types";
import { patchMeeting, removeMeetingWithCascade } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = Meeting.omit({ id: true }).partial();

async function PATCH_handler(req: NextRequest, ctx: RouteContext) {
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
    const email = await getWritableUserEmail();
    await patchMeeting(email, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function DELETE_handler(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const email = await getWritableUserEmail();
    // 2026-05-18 Phase 1: cascade — 미팅 삭제 시 매칭 계약카드 자동 clear.
    const result = await removeMeetingWithCascade(email, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const PATCH = withApiTiming("api/meeting/[id]:PATCH", PATCH_handler);
export const DELETE = withApiTiming("api/meeting/[id]:DELETE", DELETE_handler);
