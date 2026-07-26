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
 *   - **미등록(시트 없음) → /claim** — R4 G2(2026-07-26) 이후 강등의 유일한 사유.
 *     보관(수료) 수강생은 시트가 있으면 통과(무제한 CRM) — W1-1/ADR-0029 로 저장도 함께 열렸다.
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
import { findUserByEmail } from "@/repo/users";
import { shouldRedirectToClaim } from "@/repo/user-priority";
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
    // 수강생출신 트레이너(시트 없음)는 "내 아레나 일지" self-view(쿠키)일 때만 (app)
    // 대시보드 허용 — 아니면 /trainer(빈 대시보드 방지, P14).
    // ⚠️ **클레임 강등보다 반드시 먼저** — 트레이너는 시트가 없어 강등 판정에 걸리면
    // /claim ↔ / 무한루프가 된다(적대리뷰 2026-07-26). shouldRedirectToClaim 자체도
    // trainee 전용으로 막아뒀지만, 순서로도 이중 방어한다.
    if (u && u.role === "trainer" && u.status === "active" && !(await isArenaSelfView())) {
      redirect("/trainer");
    }
    // **R4 G2(2026-07-26)**: 보관(수료)이어도 본인 시트가 있으면 그대로 입장.
    // **미등록 수강생만 /claim**(직접 URL 차단). page.tsx 와 동일 판정 —
    // 중복 분기를 shouldRedirectToClaim 한 곳으로 통합했다(인벤토리 §2.4).
    // pending 은 아래 대기화면이 담당하므로 여기서 강등하지 않는다.
    // 쓰기 권한은 별도 축(getWritableUserEmail) — W1-1/ADR-0029 가 archived 차단을 **폐지**했으므로
    // 수료자는 입장(이 가드)과 저장(쓰기 진입점)이 둘 다 열린다. 미등록만 클레임으로.
    if (u && u.status !== "pending" && shouldRedirectToClaim(u)) redirect("/claim");
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
