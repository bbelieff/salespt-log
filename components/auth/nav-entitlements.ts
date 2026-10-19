/**
 * 상단바·사이드 메뉴·역할 전환이 같이 쓰는 「무엇을 보여 줄까」 판정 — 순수 함수.
 * (2026-10-19 구조 개선 ⑨: 관리자 판정이 곳마다 달라 같은 사람에게 사이드 메뉴엔 관리자 항목이
 *  보이고 상단 팝업엔 안 보이는 일이 있었다.) 서버가 준 값만 쓴다 — 이메일 직접 판정 금지.
 */
export type ViewMode = "student" | "trainer";

type MeFacts = { isAdmin?: boolean; sessionRole?: "admin" | "trainer" | "trainee" } | undefined;
type TrainerFacts = { canStudent?: boolean; canTrainer?: boolean; isAdmin?: boolean; status?: string } | undefined;

/** 관리자 세션인가 — 관리자 이메일이거나 명단 역할이 관리자. 둘 다 서버 값. */
export function isAdminSession(me: MeFacts, trainer?: TrainerFacts): boolean {
  return me?.isAdmin === true || me?.sessionRole === "admin" || trainer?.isAdmin === true;
}

/** 지금 보는 화면이 트레이너용인가 — 명시값이 없으면 주소로. */
export function viewModeFor(pathname: string | null | undefined, hint?: ViewMode): ViewMode {
  return hint ?? (pathname?.startsWith("/trainer") ? "trainer" : "student");
}

export function headerEntitlements(input: { me: MeFacts; trainer: TrainerFacts; pathname: string | null | undefined; roleMode?: ViewMode }) {
  const { me, trainer, pathname, roleMode } = input;
  const roleView = viewModeFor(pathname, roleMode);
  const isAdmin = isAdminSession(me, trainer);
  const roleToggleShown = !!trainer?.canStudent && !!trainer?.canTrainer;
  return {
    roleView,
    isAdmin,
    roleToggleShown,
    /** 수강생 화면에는 항상 복귀 링크. 두 역할 트레이너 화면은 안전한 토글만 쓴다. */
    showStudentDashboardLink: roleView === "student" || (trainer?.canStudent === true && !roleToggleShown),
    /** 트레이너 신청 — 트레이너도 관리자도 아닐 때만(신청 정보를 받은 뒤). */
    showTrainerApply: !!trainer && !trainer.canTrainer && !isAdmin,
    trainerApplyPending: trainer?.status === "pending",
    showTrainerPage: me?.sessionRole === "trainer",
  };
}
