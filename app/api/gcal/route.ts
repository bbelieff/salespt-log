/**
 * /api/gcal — 연동 카드 상태·설정·해제 (ADR-0028, gcal-1).
 *   GET    → 연결 여부·설정·쓰기가능 캘린더 목록 (평문 토큰 미포함)
 *   POST   → 설정 저장(토글·캘린더 변경) {calendarId?, meeting?, todo?, general?}
 *   DELETE → 연결 해제(구글 revoke + 토큰 비움)
 * 모두 세션 사용자 본인 대상(impersonation 무시).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionEmail } from "@/auth/identity";
import { disconnectGcal, loadGcalCard, updateGcalSettings } from "@/service/gcal-connect";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return noStore(NextResponse.json(await loadGcalCard(email)));
}

const SettingsPatch = z.object({
  calendarId: z.string().optional(),
  meeting: z.boolean().optional(),
  todo: z.boolean().optional(),
  general: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = SettingsPatch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const settings = await updateGcalSettings(email, parsed.data);
  return noStore(NextResponse.json({ settings }));
}

export async function DELETE() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  await disconnectGcal(email);
  return noStore(NextResponse.json({ ok: true }));
}
