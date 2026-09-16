import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import TopHeader from "@/components/TopHeader";
import DirtyProvider from "@/components/DirtyGuard";
import { findUserByEmail } from "@/repo/users";
import { adminNames } from "@/config";
export default async function TrainerLayout({children}:{children:React.ReactNode}) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) return children;
  // 마스터 메뉴 복귀는 /admin 화면들과 동일하게 페이지 최상단 행(배너)에 둔다(수리3 ①).
  const [canBackToAdmin, account] = await Promise.all([
    canViewAdminPages(sessionEmail), findUserByEmail(sessionEmail),
  ]);
  const name = account?.name || adminNames()[sessionEmail.toLowerCase()] || sessionEmail;
  return <DirtyProvider><TopHeader pageEmoji="" pageTitle="트레이너" sessionIdentity={{ name, email: sessionEmail }} pageAction={canBackToAdmin ? { href: "/admin", label: "← 마스터 메뉴" } : undefined} />{children}</DirtyProvider>;
}
