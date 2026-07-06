/**
 * POST /api/admin/switch  → impersonation cookie set/unset.
 *
 * Body: { email: string | null }
 *   - email = "x@y.com"  → 그 사용자를 보고 편집 (cookie set)
 *   - email = null       → impersonation 해제 (본인으로 돌아감)
 *
 * 권한 (canImpersonate):
 *   - 본인(self) → 항상 OK (의미는 없지만 noop)
 *   - admin → 누구든
 *   - active trainer → 자기가 담당하는 trainee 만
 *
 * 2026-05-11: 이전엔 admin only 였음. 트레이너가 본인 담당 trainee 시트 못 열던
 * 버그 fix — canImpersonate() 위임.
 */
import { NextResponse } from "next/server";
import {
  getSessionEmail,
  canImpersonate,
  setImpersonation,
} from "@/auth/identity";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
import { findUserByEmail } from "@/repo/users";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { email?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const target = body.email;

  if (target === null || target === "" || target === undefined) {
    await setImpersonation(null);
    revalidateAdminPages();
    return NextResponse.json({ impersonating: null });
  }

  // 대상 등록 여부
  const user = await findUserByEmail(String(target));
  if (!user) {
    return NextResponse.json({ error: "target_not_registered" }, { status: 404 });
  }

  // 권한 검사 (admin / 담당 trainer / self)
  const allowed = await canImpersonate(sessionEmail, user.email);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await setImpersonation(user.email);
  revalidateAdminPages();
  return NextResponse.json({
    impersonating: user.email,
    cohort: user.cohort,
    name: user.name,
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/switch:POST", POST_handler);
