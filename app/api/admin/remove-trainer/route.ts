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
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import {
  removeTrainerCompletely,
  findUserByEmail,
  isAdminSynthCandidate,
} from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }

  const target = String(body.email ?? "").trim();
  if (!target) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  // registry trainer row OR ADMIN_EMAILS 멤버 허용. assign-trainee / set-trainer-dept
  // 와 동일 정책 — admin row state·role 무관. synth admin (row 없음) 은
  // removeTrainerCompletely 가 매핑 cleanup 만 수행 (삭제할 row 없음).
  // 이전엔 `!u || u.role !== "trainer"` 라 admin 거부 → "김믿음 핸들" 사고 (2026-05-14).
  const u = await findUserByEmail(target);
  const isTrainerRow = !!u && u.role === "trainer";
  const isAdmin = isAdminSynthCandidate(target);
  if (!isTrainerRow && !isAdmin) {
    return NextResponse.json({ error: "not_trainer" }, { status: 404 });
  }

  await removeTrainerCompletely(target);
  revalidateAdminPages();
  return NextResponse.json({ removed: target });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/remove-trainer:POST", POST_handler);
