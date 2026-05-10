/**
 * GET /api/dashboard → DashboardView (read-only)
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 * 현재는 prototype 더미 반환. 시트 디스커버리 후 실제 wiring.
 */
import { NextResponse } from "next/server";
import { loadDashboard } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function GET() {
  try {
    const email = await getCurrentUserEmail();
    const view = await loadDashboard(email);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
