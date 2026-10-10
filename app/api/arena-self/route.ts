/**
 * POST /api/arena-self  { on: boolean }  → 수강생출신 트레이너 "내 아레나 일지"
 * self-view 토글 쿠키 set/unset (P14). 본인 브라우저 쿠키만 — 별도 권한 불요.
 * 실제 sheetId 는 서버가 me.ownArenaSheetId 로 계산(임의 주입 차단).
 */
import { NextResponse } from "next/server";
import { resolveStudentViewContext, setArenaSelfView } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const on = Boolean(body.on);
    if (on) {
      const context = await resolveStudentViewContext({
        selfViewRequested: true,
        ignoreTarget: true,
      });
      if (!context.ok || context.mode === "assigned") {
        return NextResponse.json(
          { error: "student_view_forbidden", code: "student_view_forbidden" },
          { status: 403 },
        );
      }
    }
    await setArenaSelfView(on);
    return NextResponse.json({ ok: true, on });
  } catch {
    return NextResponse.json(
      { error: "student_view_unavailable", code: "student_view_unavailable" },
      { status: 503 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/arena-self:POST", POST_handler);
