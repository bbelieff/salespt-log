/**
 * POST /api/admin/remove-trainer  { email }  — admin only.
 *
 * Active 또는 pending 트레이너 퇴출:
 *   1. 그가 담당하던 모든 trainee 의 assignedTrainer 에서 이 email 제거.
 *   2. trainer row 자체 삭제.
 *
 * reject-trainer 와의 차이: reject-trainer 는 단순 row 삭제 (pending 거절 주용도),
 * remove-trainer 는 매핑 cleanup 동반.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { removeTrainerCompletely, findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }

  const target = String(body.email ?? "").trim();
  if (!target) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainer") {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }

  await removeTrainerCompletely(target);
  return NextResponse.json({ removed: target });
}
