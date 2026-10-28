/**
 * GET  /api/trash → 앱 휴지통 목록(할 일·미팅·DB관리시트) + 되살릴 권한.
 * POST /api/trash {items:[{kind,id}]} → 고른 항목 되살리기(되살리기만 — 영구 삭제 없음).
 * 권한·출처 확인은 미팅 복원(`/api/meeting/[id]/restore`)과 같다.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWritableUserEmail, requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { listTrash, restoreTrash } from "@/service/trash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ items: z.array(z.object({ kind: z.enum(["todo", "meeting", "lead"]), id: z.string().min(1).max(100) })).min(1).max(200) });

export async function GET() {
  try {
    const view = await requireStudentViewContext();
    const canRestore = (await getWritableUserEmail()).toLowerCase() === view.email.toLowerCase();
    return NextResponse.json({ items: await listTrash(view.email, view.sheetOverride), canRestore }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "휴지통을 불러오지 못했어요." }, { status: error instanceof StudentViewContextError ? error.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const view = await requireStudentViewContext();
    if ((await getWritableUserEmail()).toLowerCase() !== view.email.toLowerCase()) return NextResponse.json({ error: "조회 중인 계정에 저장할 권한이 없어요." }, { status: 403 });
    const origin = req.headers.get("origin");
    if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin).origin)) {
      return NextResponse.json({ error: "다른 사이트의 요청은 허용하지 않아요." }, { status: 403 });
    }
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "되살릴 항목을 골라 주세요." }, { status: 400 });
    return NextResponse.json(await restoreTrash(view.email, parsed.data.items, view.sheetOverride));
  } catch (error) {
    return NextResponse.json({ error: "되살리지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: error instanceof StudentViewContextError ? error.status : 500 });
  }
}
