/**
 * POST /api/meeting/:id/revive-case  → 케이스 종료 되살리기
 *
 * 2026-05-19 (사용자 요청).
 * 완료/취소/계약 카드의 자식 추가미팅 삭제 (부모 상태 유지).
 * 자식이 계약 상태였으면 02 계약수납관리 row 도 cascade clear.
 */
import { NextRequest, NextResponse } from "next/server";
import { reviveCaseClosure } from "@/service";
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
    const result = await reviveCaseClosure(email, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
