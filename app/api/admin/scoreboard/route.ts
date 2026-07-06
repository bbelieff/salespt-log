/**
 * GET /api/admin/scoreboard  — admin 전용 아레나 전광판 데이터.
 *   ?refresh=1 → 30분 캐시 무효화(revalidateTag) 후 최신 read.
 * 응답: { byCohort: [{cohort, paidMembers, weekly:[{week,생산..}], total:{..}}] }.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import { loadScoreboard, SCOREBOARD_TAG } from "@/service/scoreboard";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (new URL(req.url).searchParams.get("refresh") === "1") {
    revalidateTag(SCOREBOARD_TAG);
  }
  const data = await loadScoreboard();
  return NextResponse.json(data);
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/admin/scoreboard:GET", GET_handler);
