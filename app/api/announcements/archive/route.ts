/**
 * GET /api/announcements/archive?offset=0&limit=15 — 업데이트 보관함 (§7-4).
 * 항목(그룹=1) 단위 페이징. 로그인 사용자 공용(개인화 없음 — visible 만).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/auth/stub";
import { listUpdatesArchive } from "@/service";

export async function GET(req: NextRequest) {
  const email = await getCurrentUserEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 15) || 15));
  try {
    const { rows, totalItems } = await listUpdatesArchive(offset, limit);
    return NextResponse.json({ rows, totalItems, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
