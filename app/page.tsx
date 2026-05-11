/**
 * / — 인트로 + 로그인 페이지 (server component).
 *
 * 라우팅 (역할별):
 *   - 미로그인         → LoginScene (Google 버튼)
 *   - admin           → /admin (항상). impersonation 쿠키 남아있어도 마스터 랜딩으로.
 *   - trainer pending → /trainer (대기 화면)
 *   - trainer (active)→ /trainer (담당 수강생 목록). impersonation 쿠키는 직접
 *                       /dashboard 진입 시에만 효과 — 트레이너 랜딩 우선.
 *   - trainee + 등록 완료   → /dashboard
 *   - trainee + 미등록      → /claim
 *
 * 변경 (fix/admin-always-land):
 *  - 이전: admin 이 impersonation 쿠키 있으면 즉시 /dashboard 진입.
 *          → 옛 쿠키가 남아있는 admin 이 로그인하면 의도와 달리 dashboard 직진.
 *  - 변경: admin/trainer 는 무조건 본인 메뉴 페이지(/admin, /trainer) 로 안착.
 *          impersonation 은 그 페이지에서 명시적으로 사용자 선택했을 때만 발동
 *          (POST /api/admin/switch + 클라이언트 router.push("/dashboard")).
 */
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/repo/users";
import { getSessionEmail, getEffectiveRole } from "@/auth/identity";
import LoginScene from "@/components/auth/LoginScene";

export default async function HomePage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return <LoginScene />;

  const { role } = await getEffectiveRole(sessionEmail);

  if (role === "admin") {
    redirect("/admin");
  }

  if (role === "trainer") {
    redirect("/trainer"); // pending 이면 /trainer 가 대기 화면 렌더
  }

  // trainee
  const user = await findUserByEmail(sessionEmail);
  if (user) redirect("/dashboard");
  redirect("/claim");
}
