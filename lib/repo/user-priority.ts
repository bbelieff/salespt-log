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

/** 본인 시트를 가진 등록 수강생인가 — archived 라우팅 통과 판정
 * (archived-login-access, 2026-07-07). 보관(행 status=archived 또는 cohorts 보관
 * 기수)이어도 이 함수가 true 면 /claim 강제 이동 없이 대시보드 입장.
 * 트레이너/미등록(시트 없음)은 false — 기존 라우팅 유지.
 *
 * R4(G2, 2026-07-26): 이 예외가 **기본값으로 승격**됐다 — shouldRedirectToClaim 참조. */
export function hasOwnSheet(u: Pick<User, "role" | "spreadsheetId"> | null | undefined): boolean {
  return !!u && u.role === "trainee" && u.spreadsheetId.trim() !== "";
}

/**
 * **클레임 화면으로 보내야 하는가 — 라우팅 강등 판정 SSOT** (R4 G2, belie 결정 2026-07-26).
 *
 * R4 무제한 CRM 이전: 보관(행 status=archived 또는 cohorts 탭 보관 기수)이면 /claim 으로
 * 강등하고, 2026-07-07 hasOwnSheet 예외만 그걸 면제했다(함진숙 무한 클레임 루프 수정).
 * R4 이후(**G2=A**): "수료 후에도 쓰는 CRM" 이므로 그 예외가 **기본**이다 —
 * **본인 시트를 가진 등록 수강생은 보관이어도 그대로 입장**하고,
 * **미등록(시트 없음)만 /claim** 으로 보낸다.
 *
 * 보관 기수 판정(isNumericCohortArchived)·보관 마킹(users-arena)은 **분류·집계용으로 유지**
 * 되며 더 이상 라우팅 강등을 유발하지 않는다(인벤토리 §2.4 — 마킹과 강등의 결합 해소).
 *
 * ⚠️ **trainee 경로 전용 판정이다.** 트레이너·admin 은 이 함수에 오기 전에 각자 라우팅으로
 * 갈린다(page.tsx 는 role 분기가 앞, layout.tsx 는 trainer/pending 분기가 **앞**).
 * `hasOwnSheet` 는 `role==="trainee"` 를 요구하므로 트레이너를 그대로 넣으면 항상 true
 * (=/claim 무한루프)가 된다 — 그래서 **role 이 trainee 가 아니면 false(비강등)** 로
 * 명시 처리한다. 적대리뷰(2026-07-26)가 이 순서 결함을 잡았고, 같은 사고
 * (archived-login-access 2026-07-07 트레이너 차단)의 재발 방지로 함수 자체에 박제한다.
 *
 * ⚠️ 쓰기 권한은 이 함수의 소관이 아니다 — `getWritableUserEmail`(lib/auth/identity)이
 * 별도로 가른다. 입장(read)과 저장(write)은 R4 에서 분리된 축이다.
 *
 * @param u findUserByEmail(pickPreferredUser 적용) 결과. null=미등록 → true.
 */
export function shouldRedirectToClaim(
  u: Pick<User, "role" | "spreadsheetId"> | null | undefined,
): boolean {
  if (!u) return true; // 레지스트리에 행 자체가 없음 = 미등록 → 클레임
  if (u.role !== "trainee") return false; // 트레이너·admin 은 각자 라우팅(여기서 강등 금지)
  return !hasOwnSheet(u);
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

/**
 * {user, sheetRow} 들 중 pickPreferredUser 와 **동일 우선순위**로 선택된 항목 반환.
 * 레지스트리 write(updateCell)가 read(findUserByEmail)와 같은 행을 고르게 해
 * 다행 계정에서 write≠read 불일치(예: Drive 연결 무한루프)를 막는다.
 */
export function pickPreferredRow<T extends { user: User }>(items: T[]): T | null {
  const preferred = pickPreferredUser(items.map((i) => i.user));
  return preferred ? (items.find((i) => i.user === preferred) ?? null) : null;
}

/**
 * 같은 email 행들 중 **활성 아레나 trainee 행** 선택 — carryover/회장 해석 전용.
 *
 * 배경(carryover-trainer-blocks-arena §B, 2026-06-18): 수강생출신 트레이너가
 * 아레나에도 참가하면 행이 [숫자기수 · 아레나 · T(trainer)] 로 셋이 된다.
 * pickPreferredUser 는 trainer 를 최우선 반환 → 아레나 행을 못 잡아 이월/회장
 * 판정이 깨졌다. 이월·회장은 항상 **아레나 행** 기준이어야 하므로 별도 선택자.
 * 조건: status=active + 아레나 라벨(A{n}-{m}) + spreadsheetId 보유.
 */
export function pickActiveArenaRow(users: User[]): User | null {
  for (const u of users) {
    if (
      u.status === "active" &&
      isArenaCohortLabel(u.cohort) &&
      u.spreadsheetId
    ) {
      return u;
    }
  }
  return null;
}

/**
 * 표시(로스터) 전용 dedup — 같은 사람의 여러 registry 행을 대표 1행으로 접는다.
 *
 * 근인(admin-roster-dup): listAllUsers 는 registry 행을 dedup 없이 방출해, 아레나 재참가
 * (옛 숫자기수행 + A{n}-{m}행)·이메일 2개 같은 시트(별칭·직원공유) 인 **1인이 2행**으로 보였다.
 *
 * 그룹 키 = **spreadsheetId 우선**(같은 시트 = 같은 사람), 없으면(트레이너 등 시트無) email(소문자).
 * 각 그룹 대표 = pickPreferredUser(아레나>숫자·active>그외). 입력 정렬을 보존(대표 위치 그대로).
 *
 * ⚠️ **표시 경로 전용**. 행 단위 뮤테이션(approve/assign/install-formulas)은 raw listAllUsers 유지 —
 * dedup 하면 타겟 행이 사라진다.
 */
export function distinctByPreferred(users: User[]): User[] {
  const groupKey = (u: User): string => {
    const sid = String(u.spreadsheetId ?? "").trim();
    return sid !== "" ? `sheet:${sid}` : `email:${String(u.email ?? "").trim().toLowerCase()}`;
  };
  const groups = new Map<string, User[]>();
  for (const u of users) {
    const k = groupKey(u);
    const g = groups.get(k);
    if (g) g.push(u);
    else groups.set(k, [u]);
  }
  const rep = new Map<string, User>();
  for (const [k, us] of groups) rep.set(k, pickPreferredUser(us) ?? us[0]!);
  // 입력(정렬된) 순서 보존 — 그룹당 대표 행만 남긴다.
  return users.filter((u) => rep.get(groupKey(u)) === u);
}
