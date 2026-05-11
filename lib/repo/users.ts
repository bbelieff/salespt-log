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
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { findSheetByExactName } from "./drive-client";

const HEADER_RANGE = (tab: string) => `${tab}!A1:G1`;
const DATA_RANGE = (tab: string) => `${tab}!A2:G`;

function parseRow(r: unknown[]): User | null {
  const parsed = User.safeParse({
    email: r[0],
    cohort: r[1] ?? "",
    name: r[2] ?? "",
    spreadsheetId: r[3] ?? "",
    role: (r[4] as User["role"]) ?? "trainee",
    status: (r[5] as User["status"]) ?? "active",
    assignedTrainer: r[6] ?? "",
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

function invalidateRegistry(): void {
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
 * Drive API 파일명 검색 — 수강생 시트 찾기.
 * 패턴: `세일즈PT_ {cohort}기 {name} 수강생 경영일지`
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
  return findSheetByExactName(exactName);
}

/**
 * Self-claim — registry 에 (cohort, name) row 있으면 email/role/status 갱신,
 * 없으면 새 row append.
 *
 * 신규: trainer 모드 (cohort=T) 추가.
 *   - 수강생: row 가 보통 트레이너에 의해 미리 만들어져 있음 (assignedTrainer 도 사전 배정)
 *   - 트레이너: 자기 self-claim 시 row 새로 생성 (status=pending)
 */
export async function claimRegistry(
  email: string,
  cohort: string,
  name: string,
  spreadsheetId: string,
  role: User["role"] = "trainee",
  status: User["status"] = "active",
): Promise<void> {
  const reg = registry();
  // 쓰기 직전에는 최신값 필요 → 캐시 우회 (직접 readRange).
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();

  let matchIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    if (c === cohortNorm && n === cleanName) {
      matchIdx = i;
      break;
    }
  }

  if (matchIdx >= 0) {
    // 기존 row email 갱신 (역할·상태는 admin 이 별도 관리하므로 덮어쓰지 않음)
    const sheetRow = matchIdx + 2;
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!A${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[email]] },
    });
  } else {
    await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
      [email, cohortNorm, cleanName, spreadsheetId, role, status, ""],
    ]);
  }
  invalidateRegistry();
}

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
