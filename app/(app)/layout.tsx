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
import DirtyProvider from "@/components/DirtyGuard";
import {
  getSessionEmail,
  getActiveUserEmail,
  isAdminEmail,
  isArenaSelfView,
} from "@/auth/identity";
import { findUserByEmail, isNumericCohortArchived } from "@/repo/users";
import { hasOwnSheet } from "@/repo/user-priority";
import { getArchivedCohortSet } from "@/repo/cohorts";
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
    // 보관(행 status 또는 cohorts 보관 기수) → 클레임 화면 (rejoin §1, 직접 URL 차단).
    // 단, **본인 시트가 있는 등록 수강생은 보관이어도 통과**(읽기 전용 입장,
    // archived-login-access 2026-07-07). R4 W1-1/ADR-0029: 쓰기 차단은 **폐지**됐다(수료 후 편집 허용).
    // cohorts read 는 라우팅 지점인 여기서만(hot-path 분리, claim-stuck 2026-06-12).
    if (u && !hasOwnSheet(u)) {
      if (u.status === "archived") redirect("/claim");
      const archivedLabels = await getArchivedCohortSet().catch(() => new Set<string>());
      if (isNumericCohortArchived(u.role, u.cohort, archivedLabels)) redirect("/claim");
    }
    // 수강생출신 트레이너(시트 없음)는 "내 아레나 일지" self-view(쿠키)일 때만 (app)
    // 대시보드 허용 — 아니면 /trainer(빈 대시보드 방지, P14).
    if (u && u.role === "trainer" && u.status === "active" && !(await isArenaSelfView())) {
      redirect("/trainer");
    }
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
      {/* 미저장 이탈 가드(전역) — children(페이지가 register) + TabBar(가드 라우팅)가 한 컨텍스트 공유. */}
      <DirtyProvider>
        <main style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}>
          {children}
        </main>
        <TabBar />
      </DirtyProvider>
      {/* 새소식 자동 팝업 (announcement-popup §3) — 조건 미충족 시 null. */}
      <AnnouncementsGate />
      {/* 모바일 당겨서 새로고침 — PC/모달/가로 스와이프 가드 내장. */}
      <PullToRefresh />
    </div>
  );
}
