/**
 * POST /api/db/banner-post → 현수막 게시 로그(AF:AI) append (1:N). ADR-0023.
 * 응답: { ok: true, row: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { DBBannerPost } from "@/types";
import { addBannerPost } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DBBannerPost.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getCurrentUserEmail();
    const result = await addBannerPost(email, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
