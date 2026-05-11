/**
 * POST /api/admin/switch  → impersonation cookie set/unset.
 *
 * Body: { email: string | null }
 *   - email = "x@y.com"  → admin이 그 사용자를 보고 편집 (cookie set)
 *   - email = null       → impersonation 해제 (admin 본인으로 돌아감)
 *
 * Admin only. 비-Admin 은 403.
 */
import { NextResponse } from "next/server";
import {
  getSessionEmail,
  isAdminEmail,
  setImpersonation,
} from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";

export async function POST(req: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isAdminEmail(sessionEmail)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    return NextResponse.json({ impersonating: null });
  }

  // 대상 등록 여부 검증 (registry 에 있어야 함)
  const user = await findUserByEmail(String(target));
  if (!user) {
    return NextResponse.json({ error: "target_not_registered" }, { status: 404 });
  }

  await setImpersonation(user.email);
  return NextResponse.json({
    impersonating: user.email,
    cohort: user.cohort,
    name: user.name,
  });
}
