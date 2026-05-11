/**
 * / — 인트로 + 로그인 페이지 (server component).
 *
 * 라우팅 (역할별):
 *   - 미로그인              → LoginScene (Google 버튼)
 *   - admin + impersonating → /dashboard
 *   - admin                 → /admin
 *   - trainer pending       → /trainer (대기 화면)
 *   - trainer + impersonating → /dashboard
 *   - trainer               → /trainer (담당 수강생 목록)
 *   - trainee + 등록 완료   → /dashboard
 *   - trainee + 미등록      → /claim
 */
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/repo/users";
import { getSessionEmail, getActiveUserEmail, getEffectiveRole } from "@/auth/identity";
import LoginScene from "@/components/auth/LoginScene";

export default async function HomePage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return <LoginScene />;

  const { role, status } = await getEffectiveRole(sessionEmail);

  if (role === "admin") {
    const active = await getActiveUserEmail();
    if (active !== sessionEmail) redirect("/dashboard");
    redirect("/admin");
  }

  if (role === "trainer") {
    if (status === "pending") redirect("/trainer");
    const active = await getActiveUserEmail();
    if (active !== sessionEmail) redirect("/dashboard");
    redirect("/trainer");
  }

  // trainee
  const user = await findUserByEmail(sessionEmail);
  if (user) redirect("/dashboard");
  redirect("/claim");
}
