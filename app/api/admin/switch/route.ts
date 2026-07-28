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
  getActiveUserEmail,
} from "@/auth/identity";
import { resolveOwnArenaSheetId } from "@/repo/users-arena";
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

  // 개인 시트 없는 행(트레이너·미등록) 임퍼스네이션 차단 (P1, 2026-07-28) —
  // 빈 spreadsheetId 로 읽기 라우트 전면 500(구글 HTML 에러)·빈 화면. 볼 수 있는 화면이 없다.
  // ※ pickPreferredUser 는 trainer 행 **최우선**(P14) — 수강생출신 트레이너는 T행(빈 시트)이
  //   선택되지만 본인 아레나 시트가 있으면 self-view 경로(resolveArenaOverride)가 합법이므로 허용.
  if (!user.spreadsheetId) {
    const arenaSheet = await resolveOwnArenaSheetId(user.email, user.name);
    if (!arenaSheet) {
      // 같은 대상에 이미 걸린 쿠키가 있으면 함께 해제 — 스테일 쿠키(30일)로 500 잔존 방지.
      const active = await getActiveUserEmail();
      if (
        active.toLowerCase() === user.email.toLowerCase() &&
        active.toLowerCase() !== sessionEmail.toLowerCase()
      ) {
        await setImpersonation(null);
        revalidateAdminPages();
      }
      return NextResponse.json(
        {
          error: `${user.name}(${user.cohort}) 계정은 볼 수 있는 일지 시트가 없어요 — 웹앱 화면 대신 관리 메뉴에서 확인해 주세요.`,
          code: "no_sheet",
        },
        { status: 409 },
      );
    }
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
