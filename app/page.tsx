/**
 * / — 인트로 + 로그인 페이지 (server component).
 *
 * 흐름:
 *   - 미로그인         → LoginScene (Google 버튼)
 *   - 로그인 + 미등록  → /claim 으로 redirect
 *   - 로그인 + 등록 완료 → /dashboard 로 redirect
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findUserByEmail } from "@/repo/users";
import LoginScene from "@/components/auth/LoginScene";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email;

  if (email) {
    const user = await findUserByEmail(email);
    if (user) redirect("/dashboard");
    redirect("/claim");
  }

  return <LoginScene />;
}
