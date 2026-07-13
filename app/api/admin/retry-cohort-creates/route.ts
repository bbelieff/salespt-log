/**
 * POST /api/admin/retry-cohort-creates — admin only. (R3-5)
 *
 * DB pending 큐(cohort_pending_creates)에 쌓인 기수-생성 잡을 배치로 재시도.
 * 각 잡: 기존 시트 재사용 or 템플릿 복제 → prep row 등록 → (아레나) roster → done 마킹.
 * 부분 실패 허용(실패는 pending 유지, 다음 호출에서 재시도).
 *
 * 용례: admin 이 Drive 토큰(ADMIN_DRIVE_REFRESH_TOKEN) 등록 후 "재시도" 1회, 또는 일시 장애 후.
 *
 * 응답: { ok, processed, done:[{name,sheetId}], stillPending:[{name,reason}], remaining }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { dbEnabled } from "@/repo/db/client";
import { countPendingCohortCreates } from "@/repo/db/cohort-pending";
import { processPendingCohortCreates } from "@/service/cohort-create";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!dbEnabled())
    return NextResponse.json(
      { error: "db_disabled", hint: "DATABASE_URL 미설정 — pending 큐를 쓸 수 없습니다." },
      { status: 503 },
    );

  const summary = await processPendingCohortCreates();
  const remaining = await countPendingCohortCreates();
  revalidateAdminPages();
  return NextResponse.json({
    ok: true,
    processed: summary.processed,
    done: summary.done,
    stillPending: summary.stillPending,
    remaining,
  });
}

export const POST = withApiTiming(
  "api/admin/retry-cohort-creates:POST",
  POST_handler,
);
