/**
 * GET /api/dashboard → DashboardView (read-only)
 *
 * SSOT: docs/domains/data-model.md §대시보드 데이터 출처
 * 현재는 prototype 더미 반환. 시트 디스커버리 후 실제 wiring.
 */
import { NextResponse } from "next/server";
import { loadDashboard } from "@/service";
import { requireStudentViewContext } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const context = await requireStudentViewContext();
    const view = await loadDashboard(context.email, context.sheetOverride);
    return NextResponse.json(view);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (
      e instanceof Error &&
      "code" in e &&
      "status" in e &&
      ["unauthenticated", "invalid_student_target", "student_target_required", "student_view_forbidden"].includes(String(e.code)) &&
      (e.status === 401 || e.status === 403)
    ) {
      const error = e as Error & { code: string; status: number };
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      );
    }
    if (msg.startsWith("[auth]")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (msg.startsWith("[no-sheet]")) {
      // 시트 없는 계정(트레이너 임퍼스네이션 등) — 500 아닌 명시 404 (P1 2026-07-28)
      return NextResponse.json({ error: "no_sheet" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "student_view_unavailable", code: "student_view_unavailable" },
      { status: 503 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/dashboard:GET", GET_handler);
