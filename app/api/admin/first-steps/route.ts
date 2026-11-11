/** GET /api/admin/first-steps — 관리 화면용 수강생별 첫걸음 진행(이메일 → 끝낸 단계 수). 표가 없으면 빈 지도. */
import { NextResponse } from "next/server";
import { canViewAdminPages, getSessionEmail } from "@/auth/identity";
import { listFirstStepsProgress } from "@/service";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

async function GET_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await listFirstStepsProgress(), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ byEmail: {}, total: 7 }, { headers: NO_STORE });
  }
}

export const GET = withApiTiming("api/admin/first-steps:GET", GET_handler);
