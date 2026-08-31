/**
 * Layer: service — 기수 생성(DB-only) 멤버 1명 처리 판정 (순수). BBE-70(R7-#21).
 *
 * `cohort-token.ts:decideMemberAction` 의 DB 버전 — 폴더/시트 개념이 없어 훨씬 단순하다.
 * googleapis 의존 0. I/O(기존 행 조회)는 route 가 수행하고 결정 로직만 여기 둔다.
 */
export type MemberDbPlan =
  | { action: "skip"; name: string }
  | { action: "fail"; name: string; reason: string }
  | { action: "create"; name: string };

/**
 * 멱등: (cohort, name) 이 이미 DB 에 있으면 skip(재제출해도 중복 생성 없음).
 * 이름이 비었으면 fail. 그 외는 create.
 */
export function decideMemberDbAction(input: {
  name: string;
  existingUser: boolean;
}): MemberDbPlan {
  const name = input.name.trim();
  if (!name) return { action: "fail", name: input.name, reason: "이름 없음" };
  if (input.existingUser) return { action: "skip", name };
  return { action: "create", name };
}
