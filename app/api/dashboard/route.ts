/**
 * GET /api/dashboard  → DashboardView (read-only)
 *
 * SSOT: docs/domains/sheet-structure.md §1
 * 시트의 "대시보드(자동작성)" 탭을 1회 batchGet 으로 읽고
 * service.loadDashboard 가 cell → DashboardView 매핑.
 *
 * UI 는 Recharts 입력으로 그대로 사용. 5분 stale (lib/query/dashboard-hooks.ts).
 */
import { NextResponse } from "next/server";
import { loadDashboard } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function GET() {
  try {
    const email = getCurrentUserEmail();
    const view = await loadDashboard(email);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
