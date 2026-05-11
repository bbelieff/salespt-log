/**
 * POST /api/admin/approve-trainer  { email }  — admin only.
 * pending 트레이너의 status 를 active 로 전환.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { approveTrainer, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { email?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  const target = String(body.email ?? "").trim();
  if (!target) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainer") return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  await approveTrainer(target);
  return NextResponse.json({ approved: target });
}
