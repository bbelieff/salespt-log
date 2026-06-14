/**
 * Layer: repo (순수 함수 — Sheets I/O 없음).
 * 같은 이메일에 여러 registry 행이 있을 때 라우팅/클레임 대상 1행 선택.
 *
 * 배경 (arena-cohort-consistency §1, 2026-06-12): 아레나 재참가자는 옛 숫자 기수
 * 행(예: 6기 — cohorts 탭 archived)과 새 아레나 행(A1-6)을 동시에 보유한다.
 * findUserByEmail 이 행 순서대로 첫 active 를 반환하면 옛 6기 행이 먼저 잡혀
 * page/layout 의 isNumericCohortArchived("6") 가 /claim 으로 강등 → 아레나
 * 대시보드 진입 불가. 그래서 아레나 행을 옛 숫자 active 보다 우선한다.
 */
import { User } from "@/types";

/** cohort 라벨이 아레나 형태(A{시즌}-{기수}) 인가. "A1-6", "A1-6기" → true. */
export function isArenaCohortLabel(cohort: string): boolean {
  return /^A\d+-\d+/.test(String(cohort).trim());
}

/** 우선순위: 아레나 non-archived > 숫자 non-archived > archived fallback. */
export function pickPreferredUser(users: User[]): User | null {
  let active: User | null = null;
  let archived: User | null = null;
  for (const u of users) {
    if (u.status === "archived") {
      archived ??= u;
      continue;
    }
    if (isArenaCohortLabel(u.cohort)) return u;
    active ??= u;
  }
  return active ?? archived;
}
