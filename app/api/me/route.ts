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
  getSessionEmail,
  getEffectiveRole,
  isAdminEmail,
  resolveStudentViewContext,
} from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const admin = isAdminEmail(sessionEmail);
  const context = await resolveStudentViewContext();
  const { role: sessionRole } = await getEffectiveRole(sessionEmail);

  if (!context.ok) {
    // 기존 관리자 무대상 landing과 신규 수강생 claim 흐름은 유지한다.
    const own = await findUserByEmail(sessionEmail);
    if (admin && !own) {
      return NextResponse.json({
        status: "admin_no_target",
        isAdmin: true,
        sessionRole,
      });
    }
    if (!admin && sessionRole === "trainee" && !own) {
      return NextResponse.json({ status: "needs_claim" }, { status: 200 });
    }
    return NextResponse.json(
      { error: context.code, code: context.code },
      { status: context.status },
    );
  }
  const activeEmail = context.email;

  const user = await findUserByEmail(activeEmail);

  // 비-Admin + 미등록 = claim 필요
  if (!user && !admin) {
    return NextResponse.json({ status: "needs_claim" }, { status: 200 });
  }

  // Admin + 본인 미등록 + 아무도 impersonate 안 함 → admin landing
  if (!user && admin && activeEmail === sessionEmail) {
    return NextResponse.json({
      status: "admin_no_target",
      isAdmin: true,
      sessionRole,
    });
  }

  // 정상 프로필 로드
  try {
    const me = await loadMe(activeEmail, context.mode === "arena");
    const res = NextResponse.json({
      ...me,
      isAdmin: admin,
      sessionEmail,
      sessionRole,
      impersonating: activeEmail.toLowerCase() !== sessionEmail.toLowerCase() ? activeEmail : null,
    });
    // **never cache** — 브라우저 HTTP 캐시가 impersonation cookie 변경을 무시하고
    // 이전 trainee 의 응답을 그대로 반환하는 사고가 있었음 (2026-05-13).
    // useMe 의 React Query staleTime: 1h 가 client 측 캐싱을 담당하므로 server
    // 응답 자체는 매번 fresh 해야 cookie 변경이 즉시 반영됨.
    // private + no-store + must-revalidate 3중 안전.
    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );
    return res;
  } catch {
    return NextResponse.json(
      { error: "student_view_unavailable", code: "student_view_unavailable" },
      { status: 503 },
    );
  }
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const GET = withApiTiming("api/me:GET", GET_handler);
