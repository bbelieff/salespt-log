/**
 * POST /api/admin/arena-carryover { email } — admin 전용 이월 backfill (carryover §2-b).
 * 이미 클레임을 마친 재참가자용. 멱등 — 재실행 안전. 결과 리포트 반환.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { migrateArenaCarryover } from "@/service/arena-carryover";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "email 필수" }, { status: 400 });

  try {
    const report = await migrateArenaCarryover(email);
    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
