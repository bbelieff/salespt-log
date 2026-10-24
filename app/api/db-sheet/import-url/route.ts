/**
 * POST /api/db-sheet/import-url {url} — 구글시트 공유 주소의 표를 CSV 글로 돌려준다(DB 가져오기, 2026-10-24 belie).
 * 저장은 하지 않는다 — 화면이 이 글을 붙여넣은 내용과 똑같이 자동 배치하고, 확인한 DB만 추가한다.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { loadGoogleSheetImportText, GoogleSheetImportError } from "@/service/db-sheet-import-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ url: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  try {
    await requireStudentViewContext();
    if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." }, { status: 403 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "구글시트 주소를 넣어 주세요." }, { status: 400 });
    return NextResponse.json({ text: await loadGoogleSheetImportText(parsed.data.url) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof GoogleSheetImportError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "구글시트를 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  }
}
