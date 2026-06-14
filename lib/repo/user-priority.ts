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

/** dedup: 같은 email 다중 행 중 **유지할** 행 index. 우선순위 ① 아레나 > 숫자,
 * ② active > 그외, ③ 같으면 마지막(최신). 나머지는 삭제 대상(registry-backfill §1). */
export function dedupKeepIndex(
  rows: { cohort: string; status: string }[],
): number {
  const score = (x: { cohort: string; status: string }) =>
    (isArenaCohortLabel(x.cohort) ? 2 : 0) + (x.status === "active" ? 1 : 0);
  let best = 0;
  for (let i = 1; i < rows.length; i++) {
    // 점수 높은 쪽, 같으면 뒤(최신) 우선.
    if (score(rows[i]!) >= score(rows[best]!)) best = i;
  }
  return best;
}

/** B(cohort) 숫자인데 I(label) 아레나(A{n}-{m}) → 교정값(A{n}-{m}) 반환, 아니면 null.
 * 시트·I열이 진실, B열만 옛 숫자로 오저장된 경우 정합(registry-backfill §2). */
export function arenaCohortCorrection(
  cohort: string,
  label: string,
): string | null {
  const b = String(cohort).replace(/기\s*$/, "").trim();
  const l = String(label).replace(/기\s*$/, "").trim();
  return /^\d+$/.test(b) && /^A\d+-\d+$/.test(l) ? l : null;
}

/** 우선순위: trainer(수강생출신 트레이너 — /trainer 착지, P14) > 아레나 non-archived
 * > 숫자 non-archived > archived fallback. trainer 행 + 아레나 trainee 행을 둘 다
 * 가진 사용자는 트레이너로 착지하고, 아레나 일지는 토글(ownArenaSheetId)로 본다. */
export function pickPreferredUser(users: User[]): User | null {
  let arena: User | null = null;
  let active: User | null = null;
  let archived: User | null = null;
  for (const u of users) {
    if (u.status === "archived") {
      archived ??= u;
      continue;
    }
    if (u.role === "trainer") return u; // 최우선
    if (isArenaCohortLabel(u.cohort)) arena ??= u;
    else active ??= u;
  }
  return arena ?? active ?? archived;
}
