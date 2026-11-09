/** 간편인증 서류 조회 API 공통 — 로그인·조회 계정·쓰기 권한·같은 사이트 확인, 오류 → 짧은 문구(CODEF·DB 오류 원문 노출 금지). */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getWritableUserEmail, requireStudentViewContext, StudentViewContextError } from "@/auth/identity";
import { SimpleAuthError, simpleAuthWho, type SimpleAuthWho } from "@/service/simple-auth";
import { DbSheetConflict, DbSheetDuplicate, DbSheetLinkedMeetingReadOnly, DbSheetOperationBlocked } from "@/service/call-confirm";

export const headers = { "Cache-Control": "private, no-store" };

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

export function errorResponse(e: unknown) {
  if (e instanceof StudentViewContextError) return NextResponse.json({ error: e.code }, { status: e.status, headers });
  if (e instanceof SimpleAuthError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof DbSheetConflict) return NextResponse.json({ error: "다른 화면에서 이 DB가 바뀌었어요. 새로고침한 뒤 다시 해 주세요." }, { status: 409, headers });
  if (e instanceof DbSheetLinkedMeetingReadOnly || e instanceof DbSheetOperationBlocked || e instanceof DbSheetDuplicate) return NextResponse.json({ error: e.message }, { status: 409, headers });
  if (e instanceof ZodError || e instanceof SyntaxError) return NextResponse.json({ error: "입력을 확인해 주세요." }, { status: 400, headers });
  return NextResponse.json({ error: "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 503, headers });
}

/** write=true 면 조회 중인 계정이 내 계정이고 같은 사이트 요청일 때만. */
export async function withWho(req: NextRequest, write: boolean, run: (who: SimpleAuthWho) => Promise<Response | unknown>) {
  try {
    const view = await requireStudentViewContext();
    if (write) {
      if ((await getWritableUserEmail()).toLowerCase() !== view.email.toLowerCase()) {
        return NextResponse.json({ error: "조회 중인 계정에 저장할 권한이 없습니다." }, { status: 403, headers });
      }
      if (!sameSite(req)) return NextResponse.json({ error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." }, { status: 403, headers });
    }
    const out = await run(await simpleAuthWho(view.email, view.sheetOverride));
    return out instanceof Response ? out : NextResponse.json(out ?? { ok: true }, { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
