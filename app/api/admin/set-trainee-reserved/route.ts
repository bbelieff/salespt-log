/**
 * POST /api/admin/set-trainee-reserved  { email, reserved: boolean }  — admin only.
 *
 * Trainee 의 유보(reserved) 상태 토글.
 *   - reserved=true  → registry B="유보". /admin/users 의 정규 기수 그룹에서 제외,
 *                        "유보 수강생" 별도 섹션에만 노출.
 *   - reserved=false → registry B="" (복귀). 표시 라벨은 개인 시트 B3 SSOT.
 *
 * 의도: 마스터 본인 계정처럼 명단에서 보기 싫지만 row 는 남겨두고 싶은 trainee
 * 정리. 퇴출(row 삭제) 전 안전한 중간 단계.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { findUserByEmail, setTraineeReservation } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string; reserved?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const target = String(body.email ?? "").trim();
  if (!target || typeof body.reserved !== "boolean") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const u = await findUserByEmail(target);
  if (!u || u.role !== "trainee") {
    return NextResponse.json({ error: "not_trainee" }, { status: 404 });
  }

  await setTraineeReservation(target, body.reserved);
  revalidateAdminPages();
  return NextResponse.json({
    updated: { email: target, reserved: body.reserved },
  });
}
