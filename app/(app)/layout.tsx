/**
 * (app) route group — 로그인 후 5탭 셸.
 *
 * 모든 (app)/* 페이지는 자동으로 하단 TabBar 를 갖는다.
 * content-area 패딩은 TabBar(76px) 와 겹치지 않도록 76px.
 *
 * 권한 가드 (server component):
 *   - 미로그인 → /
 *   - pending trainee → 대기 화면 (직접 URL 입력으로 /dashboard 진입 차단).
 *   - admin 은 impersonation 으로 진입할 수 있어 통과.
 *   - active trainee/trainer 통과.
 *
 * 페이지 배경: bg-slate-100 (#f1f5f9)
 */
import { redirect } from "next/navigation";
import TabBar from "@/components/TabBar";
import {
  getSessionEmail,
  getActiveUserEmail,
  isAdminEmail,
} from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";
import PendingApprovalScreen from "@/components/auth/PendingApprovalScreen";
import AnnouncementsGate from "@/components/announcements/AnnouncementsGate";
import PullToRefresh from "@/components/PullToRefresh";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");

  // admin 본인은 통과 (impersonation 으로 누구든 진입 가능).
  if (!isAdminEmail(sessionEmail)) {
    // 활성 대상(impersonation 적용)이 pending 이면 대기 화면.
    const activeEmail = await getActiveUserEmail();
    const u = await findUserByEmail(activeEmail);
    if (u && u.status === "archived") redirect("/claim"); // rejoin §1 — 직접 URL 도 차단
    if (u && u.status === "pending") {
      return (
        <PendingApprovalScreen
          subtitle={
            u.role === "trainer"
              ? "관리자 승인 후 담당 수강생을 볼 수 있어요. 조금만 기다려 주세요."
              : "관리자 승인 후 작성할 수 있어요. 조금만 기다려 주세요."
          }
        />
      );
    }
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <main style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}>
        {children}
      </main>
      <TabBar />
      {/* 새소식 자동 팝업 (announcement-popup §3) — 조건 미충족 시 null. */}
      <AnnouncementsGate />
      {/* 모바일 당겨서 새로고침 — PC/모달/가로 스와이프 가드 내장. */}
      <PullToRefresh />
    </div>
  );
}
