/**
 * / — 인트로 + 로그인 페이지 (server component).
 *
 * 라우팅 (역할별):
 *   - 미로그인         → LoginScene (Google 버튼)
 *   - admin           → /admin (항상). impersonation 쿠키 남아있어도 마스터 랜딩으로.
 *   - trainer pending → /trainer (대기 화면)
 *   - trainer (active)→ /trainer (담당 수강생 목록). impersonation 쿠키는 직접
 *                       /dashboard 진입 시에만 효과 — 트레이너 랜딩 우선.
 *   - trainee active   → /dashboard
 *   - trainee pending  → PendingApprovalScreen (관리자 승인 대기)
 *   - trainee 미등록   → /claim
 *
 * 변경 (fix/admin-always-land):
 *  - 이전: admin 이 impersonation 쿠키 있으면 즉시 /dashboard 진입.
 *          → 옛 쿠키가 남아있는 admin 이 로그인하면 의도와 달리 dashboard 직진.
 *  - 변경: admin/trainer 는 무조건 본인 메뉴 페이지(/admin, /trainer) 로 안착.
 *          impersonation 은 그 페이지에서 명시적으로 사용자 선택했을 때만 발동
 *          (POST /api/admin/switch + 클라이언트 router.push("/dashboard")).
 */
import { redirect } from "next/navigation";
import { findUserByEmail, isNumericCohortArchived } from "@/repo/users";
import { hasOwnSheet } from "@/repo/user-priority";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { getSessionEmail, getEffectiveRole, isArenaSelfView } from "@/auth/identity";
import LoginScene from "@/components/auth/LoginScene";
import PendingApprovalScreen from "@/components/auth/PendingApprovalScreen";

// **force-dynamic** — claim 직후 router.push("/") 했을 때 옛 캐시가 보이면
// 안 됨. 사고 (2026-05-13): 새 사용자가 /claim 성공해도 홈 server component
// 캐시가 stale 이라 findUserByEmail null → 다시 redirect("/claim") → 사용자가
// "필드만 reset 되고 안 들어가진다" 인식. force-dynamic + claim API 의 revalidatePath
// 둘 다 보강.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return <LoginScene />;

  const { role } = await getEffectiveRole(sessionEmail);

  if (role === "admin") {
    redirect("/admin");
  }

  if (role === "trainer") {
    // 수강생출신 트레이너 "내 아레나 일지" self-view 중이면 대시보드로(토글 상태 유지, P14).
    if (await isArenaSelfView()) redirect("/dashboard");
    redirect("/trainer"); // pending 이면 /trainer 가 대기 화면 렌더
  }

  // trainee
  // null 이면 fresh(캐시 우회) 1회 재확인 — claim 직후 unstable_cache 전파 지연으로
  // 방금 등록 행을 못 보고 /claim 으로 튕기던 무반응 루프 차단(claim-stuck 2026-06-12).
  // 정상 사용자는 첫 read 에서 잡혀 fresh read 안 함(quota 영향 최소).
  let user = await findUserByEmail(sessionEmail);
  if (!user) user = await findUserByEmail(sessionEmail, { fresh: true });
  if (!user) redirect("/claim");
  // 보관(archived) — 행 자체 또는 cohorts 탭 보관 기수(rejoin §1) → 클레임 화면으로.
  // 단, **본인 시트가 있는 등록 수강생은 보관이어도 통과**(읽기 전용 입장,
  // archived-login-access 2026-07-07 — 함진숙 무한 클레임 루프 수정). 재참가가 필요한
  // 사람은 /claim 을 직접 열어 이용(강제 리다이렉트만 제거, 클레임 자체는 유지).
  // cohorts read 는 라우팅 결정 지점인 여기서만(hot-path findUserByEmail 에서 분리,
  // claim-stuck quota 경감 2026-06-12).
  if (!hasOwnSheet(user)) {
    if (user.status === "archived") redirect("/claim");
    const archivedLabels = await getArchivedCohortSet().catch(() => new Set<string>());
    if (isNumericCohortArchived(user.role, user.cohort, archivedLabels)) redirect("/claim");
  }
  // 트레이너처럼 수강생도 admin 승인 필요 (2026-05-12).
  // 기존 active trainee 들은 영향 없음 (이미 status=active).
  if (user.status === "pending") {
    return (
      <PendingApprovalScreen subtitle="관리자 승인 후 작성할 수 있어요. 조금만 기다려 주세요." />
    );
  }
  redirect("/dashboard");
}
