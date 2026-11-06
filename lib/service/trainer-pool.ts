/**
 * Layer: service — 지금 활성 트레이너 풀(퇴출·관리부서 제외) 판정. 순수 함수.
 * 수강생관리(/admin/users · /trainer)의 「담당」 표시와 같은 규칙이다(UsersRoster.tsx activeTrainers).
 * 주간목표 회의표 「담당T」가 저장된 담당 칸(퇴출 트레이너 잔재 포함)을 그대로 읽어 수강생관리와
 * 다르게 보였다(2026-11-06 belie) — 담당을 보여 주는 곳은 이 판정을 함께 쓴다.
 */
interface PoolUser { email: string; role?: string; status?: string; cohort?: string }

/** 활성 트레이너 이메일(소문자). 관리부서(cohort 「관리」) 제외, 관리자(ADMIN_EMAILS)는 수강생 행이 아니면 포함. */
export function activeTrainerEmails(all: readonly PoolUser[], adminLc: readonly string[]): Set<string> {
  const admins = new Set(adminLc);
  const out = new Set<string>();
  for (const u of all) {
    const lc = u.email.toLowerCase();
    if ((u.cohort ?? "").trim() === "관리") continue;
    if (u.role === "trainer" && u.status === "active") out.add(lc);
    else if (u.role !== "trainee" && admins.has(lc)) out.add(lc);
  }
  // 등록 행 없는 관리자도 트레이너 풀이다(수강생관리의 합성 관리자 행과 같다).
  const known = new Set(all.map(u => u.email.toLowerCase()));
  for (const e of admins) if (!known.has(e)) out.add(e);
  return out;
}

/** 저장된 담당 이메일 중 활성 풀에 있는 것만. 풀을 모르면(비었으면) 거르지 않는다 — 수강생관리와 같다. */
export function activeAssigned(assigned: readonly string[], pool: ReadonlySet<string>): string[] {
  return pool.size === 0 ? [...assigned] : assigned.filter(e => pool.has(e));
}
