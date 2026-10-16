/**
 * GET /api/db → DBOverview (4섹션 모두)
 *
 * 응답: { purchases[], productions[], banners[], leads[] } — 각 항목 row 포함
 */
import { NextResponse } from "next/server";
import { loadDBOverview } from "@/service";
import {
  requireStudentViewContext,
  StudentViewContextError,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  try {
    const { email } = await requireStudentViewContext();
    const view = await loadDBOverview(email);
    return NextResponse.json(view);
  } catch (e) {
    if (e instanceof StudentViewContextError) {
      return NextResponse.json(
        { error: e.code, code: e.code },
        { status: e.status },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/db:GET", GET_handler);
