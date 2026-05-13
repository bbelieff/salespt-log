/**
 * POST /api/admin/set-trainee-team  { email, team }  — admin only.
 *
 * 수강생 row 의 H 컬럼(team) 갱신. 빈 문자열 = 미배정.
 * trim 후 저장 — admin 이 같은 팀명 다른 띄어쓰기로 입력해도 동일 그룹.
 *
 * 응답: { updated: { email, team } }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { findUserByEmail, setTraineeTeam } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; team?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const target = String(body.email ?? "").trim();
  const team = String(body.team ?? "").trim();
  if (!target) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }

  await setTraineeTeam(target, team);
  revalidateAdminPages();
  return NextResponse.json({ updated: { email: target, team } });
}
