/**
 * POST /api/arena-self  { on: boolean }  → 수강생출신 트레이너 "내 아레나 일지"
 * self-view 토글 쿠키 set/unset (P14). 본인 브라우저 쿠키만 — 별도 권한 불요.
 * 실제 sheetId 는 서버가 me.ownArenaSheetId 로 계산(임의 주입 차단).
 */
import { NextResponse } from "next/server";
import { setArenaSelfView } from "@/auth/identity";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    await setArenaSelfView(Boolean(body.on));
    return NextResponse.json({ ok: true, on: Boolean(body.on) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
