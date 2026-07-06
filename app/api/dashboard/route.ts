/**
 * GET /api/dashboard → DashboardView (read-only)
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 * 현재는 prototype 더미 반환. 시트 디스커버리 후 실제 wiring.
 */
import { NextResponse } from "next/server";
import { loadDashboard, resolveArenaOverride } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";
import { isArenaSelfView } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const email = await getCurrentUserEmail();
    // 수강생출신 트레이너 "내 아레나 일지" self-view → 본인 아레나 시트로 override(P14).
    const override = (await isArenaSelfView())
      ? await resolveArenaOverride(email)
      : undefined;
    const view = await loadDashboard(email, override);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/dashboard:GET", GET_handler);
