/**
 * GET /api/meetings/linkable — 「영업기록 없음」 업체에 붙일 수 있는 미팅 목록
 * (취소·다른 계약에 이미 연결된 미팅 제외, 최근 미팅날짜 순). contract-meeting-link.
 */
import { NextResponse } from "next/server";
import { listLinkableMeetings } from "@/service";
import { getSessionEmail, getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  if (!(await getSessionEmail())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const email = await getWritableUserEmail();
    return NextResponse.json({ meetings: await listLinkableMeetings(email) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

export const GET = withApiTiming("api/meetings/linkable:GET", GET_handler);
