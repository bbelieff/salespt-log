/** 수강생 검색 — 이름·이메일·기수에 검색어가 들어가면 걸린다(관리자·트레이너 공용, 2026-11-10). */
export function matchesTrainee(u: { name?: string; email: string; cohort?: string | number }, q: string): boolean {
  const k = q.trim().toLowerCase();
  if (!k) return true;
  return (u.name ?? "").toLowerCase().includes(k) || u.email.toLowerCase().includes(k) || String(u.cohort ?? "").toLowerCase().includes(k);
}
