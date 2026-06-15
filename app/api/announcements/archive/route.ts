/**
 * GET /api/announcements/archive?offset=0&limit=15 — 새소식 보관함 (§7-4).
 * 업데이트는 항목(그룹=1) 단위 페이징. 공지는 offset===0(첫 페이지) 에만 전량 동봉
 * (수가 적어 페이징 불필요·중복 방지). 공지는 audience 개인화(지난 공지 포함).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/auth/stub";
import { listUpdatesArchive, listNoticesArchiveFor } from "@/service";

export async function GET(req: NextRequest) {
  const email = await getCurrentUserEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 15) || 15));
  try {
    const { rows, totalItems } = await listUpdatesArchive(offset, limit);
    const notices = offset === 0 ? await listNoticesArchiveFor(email) : [];
    return NextResponse.json({ notices, rows, totalItems, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
