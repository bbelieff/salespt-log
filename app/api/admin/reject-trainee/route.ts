/**
 * POST /api/admin/reject-trainee  { email }  — admin only.
 * pending 수강생 row 를 registry 에서 물리 삭제.
 *
 * 트레이너 거절(reject-trainer)과 동일한 패턴.
 * 안전 가드: pending 상태만 허용 — 이미 활성화된 수강생을 실수로 거절(=삭제)
 * 하지 못하게. 활성 수강생 제거는 /admin/users 유보 → 퇴출 흐름 사용.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { deleteUserByEmail, findUserByEmail } from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
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
  if (u.status !== "pending") {
    return NextResponse.json(
      {
        error: "not_pending",
        hint: "활성 수강생 제거는 유보 → 퇴출 흐름으로 처리하세요.",
      },
      { status: 409 },
    );
  }

  await deleteUserByEmail(target);
  revalidateAdminPages();
  return NextResponse.json({ rejected: target });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/reject-trainee:POST", POST_handler);
