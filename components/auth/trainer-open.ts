import { cohortCategory, cohortGroupKey } from "@/types";

export interface TrainerOpenGrants { active: boolean; arena: boolean; archived: boolean }

/**
 * 트레이너 화면에서 이 수강생 카드에 [웹앱]·[주간목표]를 붙일지(담당이 아닌 수강생 기준).
 * 서버 classifyTrainerStudent 와 같은 순서: 보관 기수 → 아레나 → 활성 수강생. 테스트(A-0)·관리자·트레이너 본인 페이지는 제외.
 * 수석(senior)은 세 가지 모두 true(2026-11-12 belie). 실제 열람은 서버 canAccessManagedStudent 가 다시 판단한다.
 */
export function trainerCanOpen(
  u: { email: string; cohort: string; captainOf?: string },
  grants: TrainerOpenGrants,
  staff: ReadonlySet<string>,
  archived: ReadonlySet<string>,
): boolean {
  if (staff.has(u.email.toLowerCase())) return false;
  const key = cohortGroupKey(u.cohort, u.captainOf);
  if (archived.has(key)) return grants.archived;
  const category = cohortCategory(key);
  if (category === "아레나") return grants.arena;
  return category === "수강생" && grants.active;
}
