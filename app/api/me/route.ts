/**
 * GET /api/me  → 사용자 프로필 + 매칭 상태 + Admin 메타.
 *
 * 응답 케이스:
 *   1. 로그인 X                                    → 401 { error: "unauthenticated" }
 *   2. 로그인 + registry 미등록 + 비-Admin         → 200 { status: "needs_claim", email }
 *   3. Admin + 등록된 활성 사용자 (or 본인)         → 200 MeProfile + admin meta
 *   4. 일반 로그인 + 등록 완료                      → 200 MeProfile
 *
 * Admin impersonation:
 *   - 활성 email (cookie `salespt_as`) 의 데이터 반환
 *   - sessionEmail / isAdmin / impersonating 필드 추가로 UI 가 모드 표시 가능
 */
import { NextResponse } from "next/server";
import { loadMe } from "@/service";
import { findUserByEmail } from "@/repo/users";
import {
  getActiveUserEmail,
  getSessionEmail,
  isAdminEmail,
} from "@/auth/identity";

export async function GET() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const admin = isAdminEmail(sessionEmail);
  const activeEmail = await getActiveUserEmail();

  const user = await findUserByEmail(activeEmail);

  // 비-Admin + 미등록 = claim 필요
  if (!user && !admin) {
    return NextResponse.json({ status: "needs_claim", email: activeEmail }, { status: 200 });
  }

  // Admin + 본인 미등록 + 아무도 impersonate 안 함 → admin landing
  if (!user && admin && activeEmail === sessionEmail) {
    return NextResponse.json({
      status: "admin_no_target",
      email: sessionEmail,
      isAdmin: true,
    });
  }

  // 정상 프로필 로드
  try {
    const me = await loadMe(activeEmail);
    return NextResponse.json({
      ...me,
      isAdmin: admin,
      sessionEmail,
      impersonating: admin && activeEmail !== sessionEmail ? activeEmail : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
