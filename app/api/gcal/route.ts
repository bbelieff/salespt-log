/**
 * /api/gcal — 연동 카드 상태·설정·해제 (ADR-0028, gcal-1).
 *   GET    → 연결 여부·설정·쓰기가능 캘린더 목록 (평문 토큰 미포함)
 *   POST   → 설정 저장(대상 캘린더 변경) {calendarId?}
 *   DELETE → 연결 해제(구글 revoke + 토큰 비움)
 * 귀속(fix/gcal-per-user-identity): 표시는 **화면의 수강생(active)** 기준,
 * 조작(POST/DELETE)은 본인만 — 임퍼스네이션이면 403 (마스터 계정 오귀속 차단).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { disconnectGcal, loadGcalCard, updateGcalSettings } from "@/service/gcal-connect";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

async function actorOr401(): Promise<ReturnType<typeof gcalActorFrom> | NextResponse> {
  const session = await getSessionEmail();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return gcalActorFrom(session, await getActiveUserEmail());
}

const SELF_ONLY = () =>
  NextResponse.json({ error: "self_only" }, { status: 403 }); // 본인 로그인에서만

export async function GET() {
  const actor = await actorOr401();
  if (actor instanceof NextResponse) return actor;
  const card = await loadGcalCard(actor.email);
  return noStore(NextResponse.json({ ...card, impersonated: actor.impersonated }));
}

const SettingsPatch = z.object({
  calendarId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const actor = await actorOr401();
  if (actor instanceof NextResponse) return actor;
  if (actor.impersonated) return SELF_ONLY();
  const parsed = SettingsPatch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const settings = await updateGcalSettings(actor.email, parsed.data);
  return noStore(NextResponse.json({ settings }));
}

export async function DELETE() {
  const actor = await actorOr401();
  if (actor instanceof NextResponse) return actor;
  if (actor.impersonated) return SELF_ONLY();
  await disconnectGcal(actor.email);
  return noStore(NextResponse.json({ ok: true }));
}
