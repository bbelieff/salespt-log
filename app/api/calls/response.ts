/** 통화 정리 API 공통 — 로그인·조회 계정·쓰기 권한·같은 사이트 확인, 오류 → 짧은 문구(통화 내용·DB 오류 노출 금지). */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getWritableUserEmail, requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { CallLeadMissing, CallSummaryError } from "@/service/call-summary";
import { DbSheetUnavailable, resolveDbSheetContext } from "@/service/db-sheet";

const headers = { "Cache-Control": "private, no-store" };

function sameSite(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  let expected = req.nextUrl.origin;
  if (process.env.AUTH_URL) {
    try {
      const configured = new URL(process.env.AUTH_URL);
      if (!["https:", "http:"].includes(configured.protocol)) return false;
      expected = configured.origin;
    } catch { return false; }
  }
  return (!origin || origin === expected) && req.headers.get("sec-fetch-site") !== "cross-site";
}

type Who = { email: string; spreadsheetId: string };

/** write=true 면 조회 중인 계정이 내 계정이고 같은 사이트 요청일 때만. */
export async function callResponse(req: NextRequest, write: boolean, run: (who: Who) => Promise<unknown>) {
  try {
    const view = await requireStudentViewContext();
    if (write) {
      if ((await getWritableUserEmail()).toLowerCase() !== view.email.toLowerCase()) {
        return NextResponse.json({ error: "조회 중인 계정에 저장할 권한이 없습니다." }, { status: 403, headers });
      }
      if (!sameSite(req)) return NextResponse.json({ error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." }, { status: 403, headers });
    }
    const ctx = await resolveDbSheetContext(view.email, view.sheetOverride);
    return NextResponse.json((await run({ email: view.email, spreadsheetId: ctx.spreadsheetId })) ?? { ok: true }, { headers });
  } catch (e) {
    if (e instanceof StudentViewContextError) return NextResponse.json({ error: e.code }, { status: e.status, headers });
    if (e instanceof CallSummaryError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    if (e instanceof CallLeadMissing) return NextResponse.json({ error: "업체를 찾을 수 없어요" }, { status: 404, headers });
    if (e instanceof ZodError || e instanceof SyntaxError) return NextResponse.json({ error: "입력을 확인해 주세요." }, { status: 400, headers });
    if (e instanceof DbSheetUnavailable) return NextResponse.json({ error: e.message }, { status: 503, headers });
    return NextResponse.json({ error: "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503, headers });
  }
}
