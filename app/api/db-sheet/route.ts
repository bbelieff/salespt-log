import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireStudentViewContext, getWritableUserEmail, StudentViewContextError } from "@/auth/identity";
import { DbSheetConflict, DbSheetLinkedMeetingReadOnly } from "@/repo/db/db-sheet";
import { DbSheetCommand, DbSheetUnavailable, resolveDbSheetContext, loadDbSheet, executeDbSheet } from "@/service/db-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  if (error instanceof StudentViewContextError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof DbSheetConflict) return NextResponse.json({ error: "다른 화면에서 변경되었습니다. 입력 내용을 보관한 뒤 새로고침해 주세요." }, { status: 409 });
  if (error instanceof DbSheetLinkedMeetingReadOnly) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "날짜·유입채널·필수 입력값을 확인해 주세요." }, { status: 400 });
  if (error instanceof DbSheetUnavailable) return NextResponse.json({ error: error.message }, { status: 503 });
  // Never expose database errors or customer payloads to a browser/log.
  return NextResponse.json({ error: "저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요." }, { status: 503 });
}
export async function GET() {
  try {
    const view = await requireStudentViewContext();
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    return NextResponse.json({ leads: await loadDbSheet(ctx) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    const view = await requireStudentViewContext();
    if ((await getWritableUserEmail()).toLowerCase() !== view.email.toLowerCase()) {
      return NextResponse.json({ error: "조회 중인 계정에 저장할 권한이 없습니다." }, { status: 403 });
    }
    if (req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return NextResponse.json({ error: "JSON 형식으로 요청해 주세요." }, { status: 415 });
    }
    const origin = req.headers.get("origin");
    let originAllowed = origin === null;
    if (origin !== null) {
      try {
        const expected = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin);
        originAllowed = ["http:", "https:"].includes(expected.protocol) && origin === expected.origin;
      } catch { /* Invalid configured origin fails closed. */ }
    }
    if (!originAllowed || req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "다른 사이트에서 보낸 저장 요청은 허용하지 않습니다." }, { status: 403 });
    }
    const command = DbSheetCommand.parse(await req.json());
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    return NextResponse.json({ leads: await executeDbSheet(ctx, command) });
  } catch (error) { return failure(error); }
}
