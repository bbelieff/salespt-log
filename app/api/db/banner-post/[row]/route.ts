/**
 * PATCH  /api/db/banner-post/:row → 게시 로그 update
 * DELETE /api/db/banner-post/:row → 게시 로그 clear
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DBBannerPost } from "@/types";
import { patchBannerPost, removeBannerPost } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

const RowParam = z.coerce.number().int().min(2);

interface RouteContext {
  params: Promise<{ row: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { row } = await ctx.params;
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json({ error: "row 정수 필수 (≥2)" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = DBBannerPost.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    await patchBannerPost(email, rowParsed.data, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { row } = await ctx.params;
    const rowParsed = RowParam.safeParse(row);
    if (!rowParsed.success) {
      return NextResponse.json({ error: "row 정수 필수 (≥2)" }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    await removeBannerPost(email, rowParsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
