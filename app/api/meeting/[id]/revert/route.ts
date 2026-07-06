/**
 * POST /api/meeting/:id/revert  → 미팅 결과 되돌리기 + cascade
 *
 * 2026-05-17 ([2a] 사용자 요청).
 * - 계약 → 예약 + 02 계약수납관리 row clear
 * - 완료/취소 → 예약 + 사유 초기화
 * - 변경 → 예약 + 변경 자식 미팅 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { revertMeeting } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const email = await getWritableUserEmail();
    const result = await revertMeeting(email, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
