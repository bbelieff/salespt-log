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
 * R4 이후(**G2=A**): "수료 후에도 쓰는 CRM" 이므로 **등록된 사람은 강등하지 않는다** —
 * 판정 기준은 **레지스트리 행 존재 여부 하나**로 축소됐다.
 *
 * 보관 기수 판정(isNumericCohortArchived)·보관 마킹(users-arena)은 **분류·집계용으로 유지**
 * 되며 더 이상 라우팅 강등을 유발하지 않는다(인벤토리 §2.4 — 마킹과 강등의 결합 해소).
 *
 * ⚠️ **role 로 갈라지지 않는다.** 초안은 `!hasOwnSheet(u)` 를 썼고, 그 함수가
 * `role==="trainee"` 를 요구하는 탓에 **모든 트레이너가 강등 대상**이 돼 layout 에서
 * /claim 무한루프를 만들었다(적대리뷰 1). 이어 "시트 없는 등록 trainee" 강등도
 * claimAccount short-circuit 때문에 같은 루프를 만드는 것이 확인됐다(적대리뷰 2, BLOCKER).
 * → 두 사고를 한 번에 막는 유일한 안전 계약이 **"행 있으면 통과"** 다. role·시트·보관을
 * 조건에 넣지 말 것. (`hasOwnSheet` 는 아레나·표시 로직에서 계속 쓰이지만 **라우팅 계약에서는 빠졌다**.)
 *
 * ⚠️ 쓰기 권한은 이 함수의 소관이 아니다 — `getWritableUserEmail`(lib/auth/identity)이
 * 별도로 가른다. W1-1/ADR-0031 가 archived 차단을 폐지해 입장·저장이 함께 열렸다.
 *
 * @param u findUserByEmail(pickPreferredUser 적용) 결과. null=미등록 → true(유일한 강등 사유).
 */
export function shouldRedirectToClaim(
  u: Pick<User, "role" | "spreadsheetId"> | null | undefined,
): boolean {
  // **레지스트리 행이 없을 때만** 클레임으로 보낸다.
  //
  // ⚠️ 시트만 없는 **등록된** 행은 절대 강등하지 않는다(적대리뷰 BLOCKER, 2026-07-28):
  // claimAccount 는 "행이 있고 보관도 아님" 이면 레지스트리를 건드리지 않고 200 을 반환하고
  // (lib/service/auth.ts short-circuit), 클레임 화면은 200 을 받으면 "/" 로 되돌린다
  // → / ↔ /claim **영구 루프**. 그 사용자는 앱에 아예 들어올 수 없다.
  // 시트 없는 행은 열밀림 복구 잔재·수기 편집(#546 전례)으로 생길 수 있어 실재 가능하다.
  // 그런 행은 master 처럼 통과시키고, 재참가가 필요하면 /claim 을 직접 열어 이용한다.
  return !u;
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
