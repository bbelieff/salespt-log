/**
 * /api/gcal/import — 구글 캘린더에서 직접 넣은 일정을 경영일지 일반 일정으로 가져온다(gcal-import).
 *   POST → { ran, reason?, created, updated, removed }
 * 캘린더·일정 화면을 열 때 화면이 부른다. 본인 로그인에서만 — 수강생 화면을 대신 보는 중(임퍼스네이션)이면
 * 남의 구글 계정을 읽지 않도록 건너뛴다. 같은 사용자 1분 안 재호출은 서비스가 건너뛴다.
 */
import { NextResponse } from "next/server";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { importGcalEvents } from "@/service/gcal-import";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler() {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = gcalActorFrom(session, await getActiveUserEmail());
  if (actor.impersonated) {
    return NextResponse.json({ ran: false, reason: "impersonated", created: 0, updated: 0, removed: 0 });
  }
  try {
    const result = await importGcalEvents(actor.email);
    const res = NextResponse.json(result);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    console.warn("[api/gcal/import] 실패:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "import_failed" }, { status: 502 });
  }
}
export const POST = withApiTiming("api/gcal/import:POST", POST_handler);
