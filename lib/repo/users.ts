/**
 * Layer: repo — 마스터 레지스트리 (사용자 + 시트 매핑 + 역할 + 상태).
 *
 * 시트 컬럼:
 *   A: email
 *   B: cohort        — **DEPRECATED (2026-05-11)**. 표시 라벨은 개인 시트 B3 SSOT.
 *                       자동 채우기/읽기 X. 역사적 데이터로만 보존.
 *   C: name          — 마찬가지로 deprecated. 개인 시트 C3 가 진실.
 *   D: spreadsheetId (trainee 만 채움)
 *   E: role          ("trainee" / "trainer" / "admin") — **식별·라우팅 SSOT**
 *   F: status        ("active" / "pending")
 *   G: assignedTrainer (trainee row 의 담당 트레이너 email; 옵션)
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { registry, adminEmails, adminNames } from "@/config";
import { User } from "@/types";
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { findSheetByExactName, findSheetByNamePrefix } from "./drive-client";

const HEADER_RANGE = (tab: string) => `${tab}!A1:G1`;
const DATA_RANGE = (tab: string) => `${tab}!A2:G`;

function parseRow(r: unknown[]): User | null {
  // **CRITICAL** — 빈 문자열 status/role row 가 drop 되면 모든 수강생 차단 사고
  // 재현 (2026-05-12). nullish coalescing(??) 이 "" 통과시켜 Zod enum fail.
  // 명시적 normalize 로 빈 값·미지정을 default 로 흡수.
  const rawStatus = String(r[5] ?? "").trim();
  const status: User["status"] = rawStatus === "pending" ? "pending" : "active";
  const rawRole = String(r[4] ?? "").trim();
  const role: User["role"] =
    rawRole === "trainer" || rawRole === "admin" ? rawRole : "trainee";
  // 2026-05-13 사고: 시트 cohort 컬럼이 number 로 형변환된 경우 (UNFORMATTED_VALUE
  // 가 그대로 노출) Zod z.string() 가 거부 → parseRow null → 무한루프.
  // sheets-client.readRange 가 경계에서 정규화하지만 defense-in-depth 로 여기서도
  // 강제. String(null) = "null" 회피 위해 ?? "" 먼저.
  const parsed = User.safeParse({
    email: String(r[0] ?? ""),
    cohort: String(r[1] ?? ""),
    name: String(r[2] ?? ""),
    spreadsheetId: String(r[3] ?? ""),
    role,
    status,
    assignedTrainer: String(r[6] ?? ""),
  });
  return parsed.success ? parsed.data : null;
}

const REGISTRY_TAG = "registry";

/**
 * 레지스트리 전체 row 캐시 — 60초 stale.
 * 페이지 전환마다 /api/me 가 호출 → findUserByEmail 가 전체 스캔 →
 * Sheets API roundtrip 300~800ms. 레지스트리는 admin 액션 외에는 거의 변하지
 * 않으므로 60초 캐시 적절. 쓰기 시 revalidateTag("registry") 로 즉시 무효화.
 */
const cachedRegistryRows = unstable_cache(
  async (): Promise<string[][]> => {
    const reg = registry();
    return readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  },
  ["registry-rows"],
  { revalidate: 60, tags: [REGISTRY_TAG] },
);

// sibling 파일에서도 사용 — claimRegistry (users-claim.ts).
export function invalidateRegistry(): void {
  revalidateTag(REGISTRY_TAG);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await cachedRegistryRows();
  for (const r of rows) {
    if (typeof r[0] === "string" && r[0].toLowerCase() === email.toLowerCase()) {
      return parseRow(r);
    }
  }
  return null;
}

/** 전체 사용자 (정렬: 트레이너/admin 먼저, 그 다음 기수 desc, 이름 asc) */
export async function listAllUsers(): Promise<User[]> {
  const rows = await cachedRegistryRows();
  const users: User[] = [];
  for (const r of rows) {
    if (!r[0]) continue;
    const u = parseRow(r);
    if (u) users.push(u);
  }
  const rolePriority: Record<User["role"], number> = { admin: 0, trainer: 1, trainee: 2 };
  users.sort((a, b) => {
    if (rolePriority[a.role] !== rolePriority[b.role]) {
      return rolePriority[a.role] - rolePriority[b.role];
    }
    const ca = parseInt(String(a.cohort).replace(/기\s*$/, "")) || 0;
    const cb = parseInt(String(b.cohort).replace(/기\s*$/, "")) || 0;
    if (ca !== cb) return cb - ca;
    return a.name.localeCompare(b.name, "ko");
  });
  return users;
}

/**
 * registry G 컬럼(assignedTrainer)의 콤마 구분 트레이너 email 리스트 파싱.
 * 정규화: trim + lowercase + dedupe + 빈 문자열 제거.
 *
 * 2026-05-11 변경: 단일 → 다중 (1 trainee 가 여러 트레이너에게 동시 배정 가능).
 * 기존 시트의 단일 email 값도 그대로 호환 (split 이 길이 1 배열 반환).
 */
export function parseAssignedTrainers(field: string | null | undefined): string[] {
  if (!field) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of field.split(",")) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/** 트레이너 한 명이 담당하는 수강생 목록 (다중 배정 inclusion 검사). */
export async function listTraineesForTrainer(trainerEmail: string): Promise<User[]> {
  const all = await listAllUsers();
  const lc = trainerEmail.toLowerCase();
  return all.filter(
    (u) => u.role === "trainee" && parseAssignedTrainers(u.assignedTrainer).includes(lc),
  );
}

/** 승인 대기 중인 트레이너 목록. */
export async function listPendingTrainers(): Promise<User[]> {
  const all = await listAllUsers();
  return all.filter((u) => u.role === "trainer" && u.status === "pending");
}

/** 승인 대기 중인 수강생 목록. */
export async function listPendingTrainees(): Promise<User[]> {
  const all = await listAllUsers();
  return all.filter((u) => u.role === "trainee" && u.status === "pending");
}

/**
 * sheetRow (1-based) 의 한 컬럼만 update.
 * 다른 컬럼은 그대로 유지 — 부분 update 안전.
 *
 * 쓰기 직전에는 최신값이 필요해 캐시를 우회 (직접 readRange).
 * 쓰기 직후 revalidateTag("registry") 로 캐시 무효화.
 */
async function updateCell(
  email: string,
  colLetter: "A" | "B" | "C" | "D" | "E" | "F" | "G",
  value: string,
): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const lc = email.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (typeof rows[i]?.[0] === "string" && (rows[i]![0] as string).toLowerCase() === lc) {
      const sheetRow = i + 2;
      await sheetsClient().spreadsheets.values.update({
        spreadsheetId: reg.spreadsheetId,
        range: `${reg.tab}!${colLetter}${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[value]] },
      });
      invalidateRegistry();
      return;
    }
  }
  throw new Error(`[users] email ${email} 을 registry 에서 찾을 수 없습니다.`);
}

/** Admin 전용: 트레이너 승인 (status pending → active) */
export async function approveTrainer(email: string): Promise<void> {
  await updateCell(email, "F", "active");
}

/** Admin 전용: 수강생 승인 (status pending → active). 트레이너 승인과 동일 로직. */
export async function approveTrainee(email: string): Promise<void> {
  await updateCell(email, "F", "active");
}

/**
 * Admin 전용: 한 수강생의 assignedTrainer (다중) 통째로 갱신.
 * trainerEmails 가 빈 배열 → G 컬럼 빈 문자열 (담당 해제).
 */
export async function setTraineeAssignments(
  traineeEmail: string,
  trainerEmails: string[],
): Promise<void> {
  const normalized = Array.from(
    new Set(trainerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  await updateCell(traineeEmail, "G", normalized.join(","));
}

/** @deprecated 단일 배정용. setTraineeAssignments 권장. */
export async function assignTrainerToTrainee(
  traineeEmail: string,
  trainerEmail: string,
): Promise<void> {
  await updateCell(traineeEmail, "G", trainerEmail.toLowerCase());
}

/** Admin 전용: 역할 변경 (trainee ↔ trainer ↔ admin) */
export async function setUserRole(email: string, role: User["role"]): Promise<void> {
  await updateCell(email, "E", role);
}

/**
 * Admin 전용: 트레이너 소속 부서 변경 (B 컬럼 재활용).
 *   - "trainer" → B="T"     (담당 배정 가능)
 *   - "management" → B="관리" (담당 배정 대상에서 제외, 관리부서)
 *
 * role 은 trainer 그대로 유지 — 라우팅/인증 영향 없음.
 * 관리부서로 이동 시 기존 담당 매핑(trainee.G) 자동 정리.
 */
export async function setTrainerDepartment(
  email: string,
  department: "trainer" | "management",
): Promise<void> {
  const lc = email.toLowerCase();
  const cohortValue = department === "management" ? "관리" : "T";

  if (department === "management") {
    const all = await listAllUsers();
    for (const u of all) {
      if (u.role !== "trainee") continue;
      const current = parseAssignedTrainers(u.assignedTrainer);
      if (!current.includes(lc)) continue;
      await setTraineeAssignments(
        u.email,
        current.filter((e) => e !== lc),
      );
    }
  }

  // 기존 row 가 있으면 B 컬럼만 부분 update, 없으면 신규 append.
  // **Synth admin** 케이스 — ADMIN_EMAILS 에 있지만 registry 에 없는 admin
  // (예: leadbzcenter, xorud910115) 도 관리부서로 보낼 수 있어야 함.
  // 이전: updateCell 이 "email registry 에 없음" 으로 throw → 웹에서 버튼 먹통.
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const exists = rows.some(
    (r) => typeof r[0] === "string" && (r[0] as string).toLowerCase() === lc,
  );
  if (exists) {
    await updateCell(email, "B", cohortValue);
    return;
  }

  // Synth admin → registry 에 새 row append. role=trainer (라우팅 의미),
  // status=active, spreadsheetId/assignedTrainer 는 빈값.
  // 이름은 ADMIN_NAMES env 매핑 우선, 없으면 email local-part.
  const nameMap = adminNames();
  const fallbackName = nameMap[lc] ?? lc.split("@")[0] ?? lc;
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    [lc, cohortValue, fallbackName, "", "trainer", "active", ""],
  ]);
  invalidateRegistry();
}

/** 어떤 email 이 setTrainerDepartment 의 합법 대상인지 (registry trainer OR admin synth). */
export function isAdminSynthCandidate(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}

/**
 * 유보 처리 sentinel — registry B(cohort) 컬럼에 박는 값.
 * 트레이너의 "T"/"관리" 와 같은 패턴: B 컬럼은 "라벨 + 분류 sentinel" 겸용.
 * "유보" 인 trainee 는 admin/users 의 정규 기수 그룹에서 제외, 별도 섹션에서만 노출.
 */
export const TRAINEE_RESERVED_SENTINEL = "유보";

/** 등록 row 의 B 컬럼이 유보 sentinel 인지 검사. trim 후 비교. */
export function isReservedTrainee(u: { cohort: string; role: string }): boolean {
  return u.role === "trainee" && u.cohort.trim() === TRAINEE_RESERVED_SENTINEL;
}

/**
 * Admin 전용: trainee 유보 토글.
 *   - reserved=true  → registry B = "유보"
 *   - reserved=false → registry B = "" (복귀; 표시 라벨은 개인 시트 B3 SSOT 에서 채움)
 *
 * row 가 없는 trainee 는 throw — setTrainerDepartment 와 달리 trainee 의 synth
 * 케이스는 의미가 없음 (개인 시트가 있어야 trainee 임).
 */
export async function setTraineeReservation(
  email: string,
  reserved: boolean,
): Promise<void> {
  await updateCell(email, "B", reserved ? TRAINEE_RESERVED_SENTINEL : "");
}

/**
 * Admin 전용: trainee 완전 퇴출 — registry row 물리 삭제.
 * 트레이너 퇴출(removeTrainerCompletely) 처럼 매핑 cleanup 은 필요 없음
 * (trainee.G 는 trainee 자신의 컬럼이라 다른 row 가 참조하지 않음).
 *
 * 보통 유보 상태에서만 호출 (UI 가 가드) — 정규 명단에서 바로 삭제 방지 의도.
 * 단, 시트 자체는 건드리지 않음 (Google 시트 권한·데이터는 그대로).
 */
export async function removeTraineeCompletely(email: string): Promise<void> {
  await deleteUserByEmail(email);
}

/**
 * Admin 전용: registry 에서 email row 물리 삭제 (Sheets API rows.delete).
 * 트레이너 거절·중복 정리 용도. 호출 후 cache 무효화.
 */
export async function deleteUserByEmail(email: string): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const lc = email.toLowerCase();
  let matchIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (typeof rows[i]?.[0] === "string" && (rows[i]![0] as string).toLowerCase() === lc) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx < 0) {
    throw new Error(`[users] email ${email} 을 registry 에서 찾을 수 없습니다.`);
  }
  // Sheets API batchUpdate — 행 삭제는 sheetId 가 필요. 메타로 조회.
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId: reg.spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === reg.tab);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`[users] registry 탭(${reg.tab}) 의 sheetId 를 찾을 수 없습니다.`);
  }
  const sheetRow = matchIdx + 1; // header(row 0) + 1
  await sheetsClient().spreadsheets.batchUpdate({
    spreadsheetId: reg.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow,
              endIndex: sheetRow + 1,
            },
          },
        },
      ],
    },
  });
  invalidateRegistry();
}

/**
 * Admin 전용: 트레이너 퇴출 — 담당 매핑 cleanup 후 row 삭제.
 *
 *  1. 모든 trainee 의 G 컬럼(assignedTrainer)에서 이 trainer email 제거.
 *  2. trainer row 자체 삭제.
 *
 * pending 거절(reject-trainer)이 단순 row 삭제인 반면 이 함수는 active
 * 트레이너 박탈 + 잔존 매핑 정리. 호출 후 cache 무효화.
 */
export async function removeTrainerCompletely(trainerEmail: string): Promise<void> {
  const lc = trainerEmail.toLowerCase();
  const all = await listAllUsers();
  for (const u of all) {
    if (u.role !== "trainee") continue;
    const current = parseAssignedTrainers(u.assignedTrainer);
    if (!current.includes(lc)) continue;
    await setTraineeAssignments(
      u.email,
      current.filter((e) => e !== lc),
    );
  }
  await deleteUserByEmail(trainerEmail);
}

export async function registerUser(u: User): Promise<void> {
  const reg = registry();
  const validated = User.parse(u);
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    [
      validated.email,
      validated.cohort,
      validated.name,
      validated.spreadsheetId,
      validated.role,
      validated.status,
      validated.assignedTrainer,
    ],
  ]);
  invalidateRegistry();
}

/**
 * registry 에서 (cohort, name) 으로 이미 등록된 spreadsheetId 조회.
 *
 * 멀티 계정 per 시트 — 첫 사용자가 등록한 후 직원/파트너가 같은 (cohort, name)
 * 으로 self-claim 할 때, Drive 매칭(시트 이름 정확 일치)을 거치지 않고 기존
 * row 의 spreadsheetId 를 그대로 재사용. 시트 이름이 prep 패턴과 달라도
 * (`세일즈PT_ 4기 손기학 수강생 경영일지(new)` 같이) 추가 계정 등록 가능.
 *
 * 동일 (cohort, name) 의 여러 row 들이 모두 같은 spreadsheetId 여야 정상.
 * 첫 비어있지 않은 spreadsheetId 반환.
 */
export async function findExistingSheetIdByCohortName(
  cohort: string,
  name: string,
): Promise<string | null> {
  const all = await cachedRegistryRows();
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  for (const r of all) {
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    const sid = String(r[3] ?? "").trim();
    if (c === cohortNorm && n === cleanName && sid) return sid;
  }
  return null;
}

/**
 * Drive API 파일명 검색 — 수강생 시트 찾기.
 *
 * 매칭 전략 (순서대로 시도):
 *   1. exact: `세일즈PT_ {N}기 {name} 수강생 경영일지` 정확 일치.
 *   2. prefix: 동일 prefix 로 시작하고 suffix 만 추가된 경우 (예: `(new)`,
 *      ` 사본`, ` v2`). 사용자가 시트 복제·이름 변경 자유롭게 가능.
 *
 * cohort=T(트레이너) 인 경우 null 반환 (검색 안 함).
 */
export async function findSheetByCohortName(
  cohort: string,
  name: string,
): Promise<string | null> {
  if (String(cohort).trim().toUpperCase() === "T") return null;
  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  const exactName = `세일즈PT_ ${cohortNum}기 ${cleanName} 수강생 경영일지`;
  const exact = await findSheetByExactName(exactName);
  if (exact) return exact;
  // exact 매칭 실패 → prefix 매칭 fallback. `(new)`, ` 사본` 등 suffix 흡수.
  return findSheetByNamePrefix(exactName);
}

// claimRegistry 는 lib/repo/users-claim.ts 로 분리 (500줄 cap).
// 외부 호출부 호환성 위해 그대로 re-export.
export { claimRegistry } from "./users-claim";

// Admin prep row 등록은 lib/repo/users-prep.ts 로 분리 (500줄 cap).
export { addTraineePrepRow } from "./users-prep";

// Header helper — 레지스트리 시트를 처음 만들 때 1회 실행.
export async function ensureRegistryHeader(): Promise<void> {
  const reg = registry();
  const existing = await readRange(reg.spreadsheetId, HEADER_RANGE(reg.tab));
  if (existing[0]?.[0] === "email") return;
  await appendRows(reg.spreadsheetId, HEADER_RANGE(reg.tab), [
    ["email", "cohort", "name", "spreadsheetId", "role", "status", "assignedTrainer"],
  ]);
}

export async function listCohortMembers(cohort: string): Promise<User[]> {
  const all = await listAllUsers();
  return all.filter((u) => String(u.cohort) === String(cohort) && u.role === "trainee");
}
