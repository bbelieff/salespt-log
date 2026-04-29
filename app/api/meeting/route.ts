/**
 * POST /api/meeting → 미팅 1건 추가
 */
import { NextRequest, NextResponse } from "next/server";
import { Meeting } from "@/types";
import { appendNewMeeting } from "@/service";
import { getCurrentUserEmail } from "@/auth/stub";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Meeting.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const email = getCurrentUserEmail();
    await appendNewMeeting(email, parsed.data);
    return NextResponse.json({ ok: true, id: parsed.data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
