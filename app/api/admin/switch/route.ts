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
 *
 * 개별 상세 프리페치 (BBE-242 설계서 보강, 2026-08-27): 클라이언트는 이 응답을 받은 뒤
 * `window.open('/dashboard', ...)`로 **새 탭**을 연다(AdminUserPicker.pick 등) — 그
 * 새 탭이 실제로 뜨기까지(TCP+TLS+HTML+hydrate) 걸리는 시간 동안, 서버는 이미
 * `warmBundle(user.spreadsheetId)` 로 대상 학생의 profile bundle 을 fire-and-forget
 * 미리 데운다. 새 탭이 자기 `/api/me`(loadMe→readBundle)를 호출할 즈음엔 캐시가
 * 이미 FRESH 이거나, 최소한 같은 in-flight Promise 를 공유해 중복 fetch 를 피한다 —
 * 클라이언트측 router.prefetch/queryClient.prefetchQuery 는 새 탭이 별도 JS 컨텍스트라
 * 효과가 없어(다른 QueryClient 인스턴스) 서버측으로 옮김.
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
import { warmBundle } from "@/service";
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

  // 개별 상세 프리페치 — await 안 함(응답 지연 유발 금지). 위 클래스 docblock 참고.
  warmBundle(user.spreadsheetId);

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
