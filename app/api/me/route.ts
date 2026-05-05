/**
 * GET /api/me  → 사용자 프로필 (시트 01 영업관리!B3:C3 SSOT).
 * 모든 탭 상단 헤더에서 "{기수} {이름}" 표시용.
 */
import { NextResponse } from "next/server";
import { loadMe } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function GET() {
  try {
    const email = getCurrentUserEmail();
    const me = await loadMe(email);
    return NextResponse.json(me);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
