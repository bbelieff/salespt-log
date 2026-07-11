/**
 * Layer: service — gcal "본인 전용" 행위자 판정 (fix/gcal-per-user-identity).
 *
 * 원칙(2026-07-10 사고 후): 연동의 모든 귀속 = **화면의 그 수강생(active)**.
 *  • 표시(카드 상태·토글 상태)는 active 기준 — 임퍼스네이션이면 그 수강생의 상태.
 *  • 명시적 조작(연결·해제·설정·토글·다시올리기)은 **본인(세션=active)만** —
 *    임퍼스네이션에서 마스터 구글 계정이 남의 시트에 연결되는 경로 원천 차단.
 *  • 자동 훅(gcal-sync)은 원래 active 토큰만 사용 — 변경 없음.
 * 순수 함수 — 라우트가 getSessionEmail/getActiveUserEmail 값을 넣어 사용.
 */
export interface GcalActor {
  /** 귀속 대상 = 화면의 수강생(active, 임퍼스네이션 반영). */
  email: string;
  /** 세션 ≠ active — 임퍼스네이션 중(조작 차단 대상). */
  impersonated: boolean;
}

export function gcalActorFrom(sessionEmail: string, activeEmail: string): GcalActor {
  const active = activeEmail.trim().toLowerCase();
  return {
    email: active,
    impersonated: active !== sessionEmail.trim().toLowerCase(),
  };
}
