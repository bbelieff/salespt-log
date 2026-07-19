/**
 * GET /api/leads?q=<검색어> → 발굴(콜·지·기·소 영업기회) 목록 (lead-chain PR-2).
 *
 * 컨택탭 발굴 피커(PR-3)용. 접수일 내림차순 + 선택 검색. 시트 I/O 신규 0(loadDBOverview 게이트 재사용).
 * `matched` 파생·필터는 PR-6 이 얹는다 — 이 라우트는 순수 목록.
 */
import { NextResponse, type NextRequest } from "next/server";
import { loadLeadsForPicker } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler(req: NextRequest) {
  try {
    const email = await getCurrentUserEmail();
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const leads = await loadLeadsForPicker(email, q);
    return NextResponse.json({ leads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const GET = withApiTiming("api/leads:GET", GET_handler);
