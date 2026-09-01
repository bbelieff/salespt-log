/**
 * Layer: repo — 마스터 레지스트리 (사용자 + 시트 매핑 + 역할 + 상태).
 * 컬럼 SSOT: docs/domains/sheet-structure.md §6 (A~R).
 *   A email · B cohort(deprecated, 시트 B3 SSOT) · C name(deprecated) · D spreadsheetId ·
 *   E role(식별·라우팅 SSOT) · F status(active/pending/archived) · G assignedTrainer ·
 *   H team · I~L 시트 캐시(B3/C3/O1/O2) · M sort_order(박스 단위 드래그 정렬) ·
 *   N~P drive 연동 · Q memo(아레나) · R captain_of.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { registry, adminEmails, adminNames } from "@/config";
import { User, cohortGroupKey, cohortGroupCompare } from "@/types";
import { readRange, sheetsClient } from "./sheets-client";
import { nextRegistryRowNumber } from "./registry-row";
import { nameMatches } from "./name-match";
import { pickPreferredUser, pickPreferredRow } from "./user-priority";
import { cachedRegistryRows, invalidateRegistry } from "./users-rows";
import {
  mirrorUserCells,
  mirrorUserRekey,
  mirrorUserRow,
  registryRowFromUser,
} from "./db/registry-mirror";

const HEADER_RANGE = (tab: string) => `${tab}!A1:T1`;
const DATA_RANGE = (tab: string) => `${tab}!A2:T`;

export function parseRow(r: unknown[]): User | null {
  // CRITICAL: 빈 status/role 이 drop 되면 전 수강생 차단 사고(2026-05-12) → 명시 normalize.
  const rawStatus = String(r[5] ?? "").trim();
  const status: User["status"] =
    rawStatus === "pending" ? "pending" : rawStatus === "archived" ? "archived" : "active";
  const rawRole = String(r[4] ?? "").trim();
  const role: User["role"] =
    rawRole === "trainer" || rawRole === "admin" ? rawRole : "trainee";
  // 모든 셀 String() 강제 — UNFORMATTED_VALUE number 가 Zod z.string() 거부 → null 무한루프 방지(2026-05-13).
  const parsed = User.safeParse({
    email: String(r[0] ?? ""),
    cohort: String(r[1] ?? ""),
    name: String(r[2] ?? ""),
    spreadsheetId: String(r[3] ?? ""),
    role,
    status,
    assignedTrainer: String(r[6] ?? ""),
    team: String(r[7] ?? ""),
    // PR B-1 cached 컬럼 — Sheets UNFORMATTED_VALUE 가 number/Date 반환 가능 →
    // 반드시 String() 정규화 (오늘 cohort number 사고 패턴 재발 방지).
    cohortLabel: String(r[8] ?? "").trim(),
    nameLabel: String(r[9] ?? "").trim(),
    courseStartISO: String(r[10] ?? "").trim(),
    graduationISO: String(r[11] ?? "").trim(),
    // sort_order(M) — number/"" 반환. NaN·음수 → 0 (Zod nonnegative reject 방지, PR C-1).
    sortOrder: (() => {
      const raw = r[12];
      if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
      const s = String(raw ?? "").trim();
      if (s === "") return 0;
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    })(),
    driveParentPath: String(r[13] ?? "").trim(),
    feedbackFolderId: String(r[14] ?? "").trim(),
    driveLinkStatus: String(r[15] ?? "").trim(),
    // r[16]=Q memo (회장/입금), r[17]=R captainOf.
    memo: String(r[16] ?? "").trim(),
    captainOf: String(r[17] ?? "").trim(),
    gcalToken: String(r[18] ?? "").trim(), // S 암호화(ADR-0028)
    gcalSettings: String(r[19] ?? "").trim(), // T JSON
  });
  return parsed.success ? parsed.data : null;
}

// 500줄 cap 분리 — 레지스트리 행 읽기 진입점(DB/시트 분기 + 폴백)은 users-rows.ts.
export { cachedRegistryRows, invalidateRegistry };

/** 보관 기수 라우팅 비활성(rejoin §1) — trainee + 숫자형("6"/"6기")만.
 * 트레이너(T)·연습·아레나 행 절대 비적용(전 트레이너 차단 사고 방지 —
 * rejoin-routing.test.ts 박제). */
export function isNumericCohortArchived(
  role: User["role"],
  cohort: string,
  archivedLabels: Set<string>,
): boolean {
  if (role !== "trainee") return false;
  const m = String(cohort).trim().match(/^(\d+)\s*기?$/);
  if (!m) return false;
  return archivedLabels.has(m[1]!) || archivedLabels.has(`${m[1]}기`);
}

/** email → User. `fresh:true` = 60s 캐시 우회 직접 read (claim 직후 캐시 전파 지연
 * /claim 루프 차단). ⚠️ cohorts-archived 강등(rejoin §1)은 hot-path quota 폭발
 * 방지로 여기서 안 함 — 라우팅 지점(page·layout)·claimAccount 에서만 1회 판정
 * (claim-stuck 2026-06-12). 여기선 행 status="archived" 만 반영. */
export async function findUserByEmail(
  email: string,
  opts?: { fresh?: boolean },
): Promise<User | null> {
  // fresh 는 시트 캐시 우회용 — DB 경로는 애초에 캐시를 타지 않아 항상 최신이다.
  const rows = await cachedRegistryRows({ fresh: opts?.fresh });
  // 다중 행 우선순위: 아레나 > 숫자 active > archived (user-priority.ts, arena-consistency §1).
  const mine: User[] = [];
  for (const r of rows) {
    if (typeof r[0] !== "string" || r[0].toLowerCase() !== email.toLowerCase()) continue;
    const u = parseRow(r);
    if (u) mine.push(u);
  }
  return pickPreferredUser(mine);
}

/** 전체 사용자 정렬 — role(admin→trainer→trainee) → cohort desc →
 * sortOrder(>0 ASC, 0=박스 하단; 같은 cohort·team 박스 內 의미) → 이름 asc(ko). */
export async function listAllUsers(): Promise<User[]> {
  const rows = await cachedRegistryRows();
  const users: User[] = [];
  for (const r of rows) {
    // **완전히 빈 행만** 건너뛴다. ⚠️ 예전엔 `if (!r[0]) continue`(= email 빈값이면 skip)
    // 였는데, 사전 등록 행은 본인이 클레임할 때까지 **email 이 비어 있는 것이 설계**라
    // (`users-prep.ts:buildPrepRowValues` A열 = "") 그 행이 명단에서 통째로 사라졌다.
    // 등록은 되는데 `/admin/users` 에서 확인할 방법이 없었다 — 2026-09-01 belie 신고
    // "신규수강생 사전등록이라는게 안되지않나?"(11기 7명·10기 김옥선 실측).
    // 로그인·조회는 email 로 매칭하므로 빈 값 행은 그 경로에 자연히 안 걸린다.
    if (!r[0] && !r[1] && !r[2]) continue;
    const u = parseRow(r);
    if (u) users.push(u);
  }
  const rolePriority: Record<User["role"], number> = { admin: 0, trainer: 1, trainee: 2 };
  users.sort((a, b) => {
    if (rolePriority[a.role] !== rolePriority[b.role]) {
      return rolePriority[a.role] - rolePriority[b.role];
    }
    const c = cohortGroupCompare(cohortGroupKey(a.cohort, a.captainOf), cohortGroupKey(b.cohort, b.captainOf));
    if (c !== 0) return c;
    // sortOrder: 0 → infinity (bottom), >0 → as-is. Same value → name ASC.
    const sa = a.sortOrder > 0 ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const sb = b.sortOrder > 0 ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, "ko");
  });
  return users;
}
// 표시(로스터) 전용 dedup 은 users-roster.ts (listDistinctUsers) — 500줄 cap 분리.
export { listDistinctUsers } from "./users-roster";

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

/** 한 컬럼만 부분 update(다른 컬럼 유지). 쓰기 직전 캐시 우회(readRange), 직후 revalidateTag. */
export async function updateUserCell(
  email: string,
  colLetter: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "N" | "O" | "P" | "S" | "T",
  value: string,
): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const lc = email.toLowerCase();
  // email 매칭 행 수집: parse 성공 행은 우선순위 선택용, 원시 행번호는 fallback.
  const rawRows: number[] = [];
  const matches: { user: User; sheetRow: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (typeof rows[i]?.[0] === "string" && (rows[i]![0] as string).toLowerCase() === lc) {
      const sheetRow = i + 2;
      rawRows.push(sheetRow);
      const u = parseRow(rows[i]!);
      if (u) matches.push({ user: u, sheetRow });
    }
  }
  if (rawRows.length === 0) {
    throw new Error(`[users] email ${email} 을 registry 에서 찾을 수 없습니다.`);
  }
  // 읽기(findUserByEmail=pickPreferredUser)와 동일 우선순위 행에 write — 다행 계정
  // write≠read 불일치 방지(Drive 연결 무한루프 fix). parse 전부 실패 시 첫 행(옛 동작).
  const picked = pickPreferredRow(matches);
  const targetRow = picked?.sheetRow ?? rawRows[0]!;
  // registry 쓰기는 RAW — 자동 type inference 차단 (PR D, 2026-05-14).
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: reg.spreadsheetId,
    range: `${reg.tab}!${colLetter}${targetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
  invalidateRegistry();
  // DB 미러(BBE-55) — 시트 쓰기 성공 후 fire-and-forget. parse 실패로 picked 가 없으면
  // 자연키(email,cohort)를 알 수 없어 미러를 건너뛴다(정합은 backfill 재실행이 복구).
  if (picked) {
    const prevKey = {
      email: picked.user.email,
      cohort: picked.user.cohort,
      name: picked.user.name,
    };
    if (colLetter === "A" || colLetter === "B" || colLetter === "C") {
      // 자연키(email·cohort·name) 자체가 바뀜 → 옛 키 삭제 + 새 키로 행 재삽입.
      const field = colLetter === "A" ? "email" : colLetter === "B" ? "cohort" : "name";
      mirrorUserRekey(prevKey, registryRowFromUser({ ...picked.user, [field]: value }));
    } else {
      mirrorUserCells(prevKey, { [colLetter]: value });
    }
  }
}

/** Admin 전용: 트레이너 승인 (status pending → active) */
export async function approveTrainer(email: string): Promise<void> {
  await updateUserCell(email, "F", "active");
}

/** Admin 전용: 수강생 승인 (status pending → active). 트레이너 승인과 동일 로직. */
export async function approveTrainee(email: string): Promise<void> {
  await updateUserCell(email, "F", "active");
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
  await updateUserCell(traineeEmail, "G", normalized.join(","));
}

/** @deprecated 단일 배정용. setTraineeAssignments 권장. */
export async function assignTrainerToTrainee(
  traineeEmail: string,
  trainerEmail: string,
): Promise<void> {
  await updateUserCell(traineeEmail, "G", trainerEmail.toLowerCase());
}

/**
 * Admin 전용: 수강생 팀 (H 컬럼) 설정. 빈 문자열 = 미배정 (기수 박스 내 개별 카드).
 * trim 후 저장 — admin 이 같은 팀명 다른 띄어쓰기로 입력해도 같은 그룹.
 */
export async function setTraineeTeam(
  traineeEmail: string,
  team: string,
): Promise<void> {
  await updateUserCell(traineeEmail, "H", team.trim());
}

/** Admin 전용: 역할 변경 (trainee ↔ trainer ↔ admin) */
export async function setUserRole(email: string, role: User["role"]): Promise<void> {
  await updateUserCell(email, "E", role);
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
    await updateUserCell(email, "B", cohortValue);
    return;
  }

  // Synth admin → registry 에 새 row append. role=trainer (라우팅 의미),
  // status=active, spreadsheetId/assignedTrainer 는 빈값.
  // 이름은 ADMIN_NAMES env 매핑 우선, 없으면 email local-part.
  const nameMap = adminNames();
  const fallbackName = nameMap[lc] ?? lc.split("@")[0] ?? lc;
  // 결정적 좌표 + RAW(PR D) — values.append 열밀림과 자동변환을 함께 방지.
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: reg.spreadsheetId,
    range: `${reg.tab}!A${nextRegistryRowNumber(rows.length)}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[lc, cohortValue, fallbackName, "", "trainer", "active", "", "", "", "", "", "", "", "", "", ""]],
    },
  });
  invalidateRegistry();
  mirrorUserRow(registryRowFromUser({
    email: lc, cohort: cohortValue, name: fallbackName, spreadsheetId: "",
    role: "trainer", status: "active", assignedTrainer: "", team: "",
    cohortLabel: "", nameLabel: "", courseStartISO: "", graduationISO: "", sortOrder: 0,
    driveParentPath: "", feedbackFolderId: "", driveLinkStatus: "",
    memo: "", captainOf: "", gcalToken: "", gcalSettings: "",
  }));
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
  await updateUserCell(email, "B", reserved ? TRAINEE_RESERVED_SENTINEL : "");
}

/**
 * Drive 연결 정보 일괄 업데이트 (N/O/P 컬럼).
 * ADR-0007: Scope 1은 Drive 읽기만 — 쓰기 API 절대 호출 금지.
 */
export async function updateDriveLink(
  email: string,
  data: { driveParentPath?: string; feedbackFolderId?: string; driveLinkStatus?: string },
): Promise<void> {
  if (data.driveParentPath !== undefined) await updateUserCell(email, "N", data.driveParentPath);
  if (data.feedbackFolderId !== undefined) await updateUserCell(email, "O", data.feedbackFolderId);
  if (data.driveLinkStatus !== undefined) await updateUserCell(email, "P", data.driveLinkStatus);
}

// 물리 삭제 + 매핑 cleanup 은 lib/repo/users-delete.ts 로 분리 (500줄 cap).
// 외부 호출부 호환성 위해 그대로 re-export.
export {
  deleteUserByEmail,
  removeTraineeCompletely,
  removeTrainerCompletely,
} from "./users-delete";

export async function registerUser(u: User): Promise<void> {
  const reg = registry();
  const validated = User.parse(u);
  // 결정적 좌표 + RAW(PR D) — values.append 열밀림과 ISO/숫자 자동변환을 방지.
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: reg.spreadsheetId,
    range: `${reg.tab}!A${nextRegistryRowNumber(rows.length)}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        validated.email,
        validated.cohort,
        validated.name,
        validated.spreadsheetId,
        validated.role,
        validated.status,
        validated.assignedTrainer,
        validated.team,
        validated.cohortLabel,
        validated.nameLabel,
        validated.courseStartISO,
        validated.graduationISO,
        String(validated.sortOrder),
        validated.driveParentPath,
        validated.feedbackFolderId,
        validated.driveLinkStatus,
      ]],
    },
  });
  invalidateRegistry();
  // 시트에는 A~P 만 append 한다 — Q~T(memo·captainOf·gcal)는 쓰지 않으므로 미러도 비운다
  // (시트에 없는 값을 DB 에만 남기면 정합 대조가 영구히 어긋난다).
  mirrorUserRow(registryRowFromUser({
    ...validated,
    memo: "", captainOf: "", gcalToken: "", gcalSettings: "",
  }));
}

// PR C-1: sortOrder(M) 일괄 update 는 lib/repo/users-sort.ts 로 분리 (500줄 cap).
export { setUserSortOrders } from "./users-sort";

/** registry 에서 (cohort, name) 으로 등록된 spreadsheetId 조회(멀티계정 per 시트 —
 *  직원/파트너 self-claim 시 Drive 매칭 없이 기존 row 재사용, prep 패턴과 달라도 가능).
 *  동일 (cohort,name) row 는 같은 sid 여야 정상. 첫 비어있지 않은 값 반환. */
export async function findExistingSheetIdByCohortName(
  cohort: string,
  name: string,
): Promise<string | null> {
  const all = await cachedRegistryRows();
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  for (const r of all) {
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "");
    const sid = String(r[3] ?? "").trim();
    // 부부면 저장 "류서하(심나영)" 이 입력 "류서하"/"심나영" 둘 다 매칭.
    if (c === cohortNorm && nameMatches(n, cleanName) && sid) return sid;
  }
  return null;
}

// 500줄 cap 분리 — 호환 re-export.
export { findSheetByCohortName } from "./users-sheet-lookup";

// 500줄 cap 분리 — 호환 re-export.
export { claimRegistry } from "./users-claim";
export { addTraineePrepRow } from "./users-prep";

// 레지스트리 시트 헤더 1회 생성.
export async function ensureRegistryHeader(): Promise<void> {
  const reg = registry();
  const existing = await readRange(reg.spreadsheetId, HEADER_RANGE(reg.tab));
  if (existing[0]?.[0] === "email") return;
  // 헤더는 row 1 고정 좌표에 직접 쓴다.
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: reg.spreadsheetId,
    range: HEADER_RANGE(reg.tab),
    valueInputOption: "RAW",
    requestBody: {
      values: [["email", "cohort", "name", "spreadsheetId", "role", "status", "assignedTrainer", "team", "cohort_label", "name_label", "course_start_iso", "graduation_iso", "sort_order", "drive_parent_path", "feedback_folder_id", "drive_link_status", "memo", "captain_of"]],
    },
  });
}

export async function listCohortMembers(cohort: string): Promise<User[]> {
  const all = await listAllUsers();
  return all.filter((u) => String(u.cohort) === String(cohort) && u.role === "trainee");
}
export { findOwnerBySpreadsheetId } from "./users-owner";
