/**
 * POST /api/meeting → 미팅 1건 추가
 */
import { NextRequest, NextResponse } from "next/server";
import { Meeting } from "@/types";
import { appendNewMeeting } from "@/service";
import { getWritableUserEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Meeting.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = await getWritableUserEmail();
    await appendNewMeeting(email, parsed.data);
    return NextResponse.json({ ok: true, id: parsed.data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/meeting:POST", POST_handler);
