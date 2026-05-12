/**
 * POST /api/admin/approve-all-pending-trainees  — admin only.
 *
 * 모든 status=pending trainee row 를 한 번에 active 로 전환.
 * /admin/users 의 "⏳ 승인 대기 수강생" 섹션 [모두 승인] 버튼이 호출.
 *
 * 응답: { ok, approved: number, failed: [{email, error}] }
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { listPendingTrainees, approveTrainee } from "@/repo/users";

export async function POST() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const pending = await listPendingTrainees();
  let approved = 0;
  const failed: { email: string; error: string }[] = [];
  for (const u of pending) {
    try {
      await approveTrainee(u.email);
      approved++;
    } catch (e) {
      failed.push({
        email: u.email,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }
  revalidateAdminPages();
  return NextResponse.json({ ok: true, approved, failed });
}
