/**
 * Layer: repo — 마스터 레지스트리(수강생 ↔ 시트 매핑) I/O.
 */
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { findSheetByExactName } from "./drive-client";

/** users 탭 헤더: email | cohort | name | spreadsheetId | role */
const HEADER_RANGE = (tab: string) => `${tab}!A1:E1`;
const DATA_RANGE = (tab: string) => `${tab}!A2:E`;

export async function findUserByEmail(email: string): Promise<User | null> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  for (const r of rows) {
    if (r[0]?.toLowerCase() === email.toLowerCase()) {
      const parsed = User.safeParse({
        email: r[0],
        cohort: r[1] ?? "",
        name: r[2] ?? "",
        spreadsheetId: r[3] ?? "",
        role: (r[4] as User["role"]) ?? "trainee",
      });
      return parsed.success ? parsed.data : null;
    }
  }
  return null;
}

/** Admin 전용: 등록된 모든 사용자 (정렬: 기수 desc, 이름 asc). */
export async function listAllUsers(): Promise<User[]> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const users: User[] = [];
  for (const r of rows) {
    if (!r[0]) continue; // email 없으면 미클레임 row (skip)
    const parsed = User.safeParse({
      email: r[0],
      cohort: r[1] ?? "",
      name: r[2] ?? "",
      spreadsheetId: r[3] ?? "",
      role: (r[4] as User["role"]) ?? "trainee",
    });
    if (parsed.success) users.push(parsed.data);
  }
  users.sort((a, b) => {
    const ca = parseInt(String(a.cohort).replace(/기\s*$/, "")) || 0;
    const cb = parseInt(String(b.cohort).replace(/기\s*$/, "")) || 0;
    if (ca !== cb) return cb - ca; // 최신 기수 먼저
    return a.name.localeCompare(b.name, "ko");
  });
  return users;
}

export async function listCohortMembers(cohort: string): Promise<User[]> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const users: User[] = [];
  for (const r of rows) {
    if (r[1] === cohort) {
      const parsed = User.safeParse({
        email: r[0],
        cohort: r[1],
        name: r[2] ?? "",
        spreadsheetId: r[3] ?? "",
        role: (r[4] as User["role"]) ?? "trainee",
      });
      if (parsed.success) users.push(parsed.data);
    }
  }
  return users;
}

export async function registerUser(u: User): Promise<void> {
  const reg = registry();
  const validated = User.parse(u);
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    [validated.email, validated.cohort, validated.name, validated.spreadsheetId, validated.role],
  ]);
}

/**
 * Drive API 파일명 검색 — 기수+이름으로 시트 찾기.
 * 패턴: `세일즈PT_ {cohort}기 {name} 수강생 경영일지`
 *
 * 반환: spreadsheetId 또는 null (0개/복수 매칭 시 호출자가 안내).
 */
export async function findSheetByCohortName(
  cohort: string,
  name: string,
): Promise<string | null> {
  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  const exactName = `세일즈PT_ ${cohortNum}기 ${cleanName} 수강생 경영일지`;
  return findSheetByExactName(exactName);
}

/**
 * Self-claim — registry 에서 (cohort, name) 매칭 row 의 email 컬럼 갱신.
 * 미존재 시 새 row append (Drive 검색으로 spreadsheetId 알아낸 경우).
 *
 * 동작:
 *   1. registry 에 (cohort, name) row 있으면 그 row 의 email 갱신
 *   2. 없으면 새 row append (email, cohort, name, spreadsheetId, 'trainee')
 */
export async function claimRegistry(
  email: string,
  cohort: string,
  name: string,
  spreadsheetId: string,
): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();

  // (cohort, name) 매칭 row 찾기
  let matchIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    if (c === cohortNum && n === cleanName) {
      matchIdx = i;
      break;
    }
  }

  if (matchIdx >= 0) {
    // 기존 row email 컬럼 update (A 컬럼)
    const sheetRow = matchIdx + 2; // header 1행 + 0-index → +2
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!A${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[email]] },
    });
  } else {
    // 새 row append
    await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
      [email, cohortNum, cleanName, spreadsheetId, "trainee"],
    ]);
  }
}

// Header helper — 레지스트리 시트를 처음 만들 때 1회 실행.
export async function ensureRegistryHeader(): Promise<void> {
  const reg = registry();
  const existing = await readRange(reg.spreadsheetId, HEADER_RANGE(reg.tab));
  if (existing[0]?.[0] === "email") return;
  await appendRows(reg.spreadsheetId, HEADER_RANGE(reg.tab), [
    ["email", "cohort", "name", "spreadsheetId", "role"],
  ]);
}
