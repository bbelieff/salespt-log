/**
 * POST /api/admin/migrate-registry-cache — admin only (PR B-3).
 *
 * registry I~L 캐시 컬럼이 빈 row 들을 일괄 backfill.
 *   - 기존(PR B-1 이전) row: 모두 빈값 → 시트 읽어서 채움.
 *   - PR B-2 prep/claim 시점 시트 read 실패 row: 빈값 → retry.
 *   - 이미 채워진 row: skip (멱등).
 *
 * 응답: { processed, updated, skipped, failed: [...] }
 *   - processed: 스캔 row 총수
 *   - updated: 실제 I~L 갱신
 *   - skipped: 이미 캐시 채워졌거나 sheetId 없음 (trainer/admin)
 *   - failed: 시트 read 실패 row 목록 (email, cohort, name, error)
 *
 * 전제: SA 가 각 trainee 시트의 reader 권한 보유.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { migrateRegistryCache } from "@/repo/users-cache-migrate";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const dynamic = "force-dynamic";

async function POST_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await migrateRegistryCache();
  return NextResponse.json(result);
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/migrate-registry-cache:POST", POST_handler);
