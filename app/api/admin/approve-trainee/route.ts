/**
 * POST /api/admin/approve-trainee  { email }  — admin only.
 * pending 수강생의 status 를 active 로 전환.
 *
 * 트레이너 승인(approve-trainer)과 동일한 패턴.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { approveTrainee, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const target = String(body.email ?? "").trim();
  if (!target)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }

  await approveTrainee(target);
  revalidateAdminPages();
  return NextResponse.json({ approved: target });
}
