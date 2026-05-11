/**
 * / — 인트로 + 로그인 페이지 (server component).
 *
 * 흐름:
 *   - 미로그인                  → LoginScene (Google 버튼)
 *   - Admin (impersonating)     → /dashboard (impersonate 대상 시트)
 *   - Admin (no impersonating)  → /admin (사용자 선택 화면)
 *   - 일반 + 등록               → /dashboard
 *   - 일반 + 미등록             → /claim
 */
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/repo/users";
import { getSessionEmail, getActiveUserEmail, isAdminEmail } from "@/auth/identity";
import LoginScene from "@/components/auth/LoginScene";

export default async function HomePage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return <LoginScene />;

  if (isAdminEmail(sessionEmail)) {
    const active = await getActiveUserEmail();
    if (active !== sessionEmail) {
      // Admin이 누군가를 impersonate 중 → 그 사람의 대시보드
      redirect("/dashboard");
    }
    // Admin 본인 + 미선택 → 사용자 선택 화면
    redirect("/admin");
  }

  const user = await findUserByEmail(sessionEmail);
  if (user) redirect("/dashboard");
  redirect("/claim");
}
