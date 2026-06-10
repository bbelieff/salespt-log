/**
 * Layer: repo — 아레나 회장/참가자 레지스트리 (users.ts 분리, 500줄 cap).
 *
 * 회장(captain) = 아레나 참가자(role=trainee 유지) + 자기 기수 조회 권한.
 * registry R(captain_of) = 맡은 cohort(정규화 "A1-1"). 빈값 = 일반 참가자. (§6/ADR-0014)
 */
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, sheetsClient } from "./sheets-client";
import { listAllUsers, invalidateRegistry } from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:R`;

/** cohort 정규화: 후행 "기" 제거 + trim → registry B/captain_of 표현(예 "A1-1"). */
export function normalizeArenaCohort(c: string): string {
  return String(c).replace(/기\s*$/, "").trim();
}

/** 아레나 라벨인가 ("A{시즌}-{기수}", 기 유무 무관). */
export function isArenaCohort(c: string): boolean {
  return /^A\d+-\d+$/.test(normalizeArenaCohort(c));
}

/** 회장 지정/해제 — registry R 에 cohort(정규화) 또는 "" 기록 (email 매칭, admin 전용). */
export async function setArenaCaptain(
  email: string,
  cohort: string,
  on: boolean,
): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const lc = email.trim().toLowerCase();
  const value = on ? normalizeArenaCohort(cohort) : "";
  for (let i = 0; i < rows.length; i++) {
    const e = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    if (e !== lc) continue;
    // registry 쓰기 RAW (PR D). R 컬럼만 부분 update.
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!R${i + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
    invalidateRegistry();
    return;
  }
  throw new Error(`[arena] 회장 대상 email(${email}) 을 registry 에서 찾을 수 없습니다.`);
}

/** 아레나 참가자 전체 (cohort 가 아레나 라벨인 trainee). prep(미클레임) 포함. */
export async function listArenaParticipants(): Promise<User[]> {
  const all = await listAllUsers();
  return all.filter((u) => u.role === "trainee" && isArenaCohort(u.cohort));
}

/** 같은 email 의 archived 행 — "이전 N기 일지 보기" 링크용 (carryover §1). */
export async function findArchivedRowByEmail(
  email: string,
): Promise<{ cohort: string; spreadsheetId: string } | null> {
  const lc = email.trim().toLowerCase();
  const all = await listAllUsers();
  for (const u of all) {
    if (u.email.toLowerCase() === lc && u.status === "archived" && u.spreadsheetId) {
      return { cohort: u.cohort, spreadsheetId: u.spreadsheetId };
    }
  }
  return null;
}

/**
 * 같은 email 의 이전 기수(비아레나) 행 — 이월 소스 (arena-carryover §2).
 * 아레나 행과 다른 spreadsheetId 를 가진 비아레나 행. 없으면 null.
 */
export async function findPriorCohortRow(
  email: string,
  arenaSheetId: string,
): Promise<{ cohort: string; spreadsheetId: string; status: User["status"] } | null> {
  const lc = email.trim().toLowerCase();
  const all = await listAllUsers();
  for (const u of all) {
    if (u.email.toLowerCase() !== lc) continue;
    if (isArenaCohort(u.cohort)) continue;
    if (!u.spreadsheetId || u.spreadsheetId === arenaSheetId) continue;
    return { cohort: u.cohort, spreadsheetId: u.spreadsheetId, status: u.status };
  }
  return null;
}

/** 이전 기수 행 status=archived 마킹 (이월 완료 후 — 라우팅 active 우선, §1). */
export async function markPriorRowArchived(
  email: string,
  cohort: string,
): Promise<void> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const lc = email.trim().toLowerCase();
  const target = normalizeArenaCohort(cohort);
  for (let i = 0; i < rows.length; i++) {
    const e = String(rows[i]?.[0] ?? "").trim().toLowerCase();
    const c = normalizeArenaCohort(String(rows[i]?.[1] ?? ""));
    if (e !== lc || c !== target) continue;
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${reg.tab}!F${i + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [["archived"]] },
    });
    invalidateRegistry();
    return;
  }
}

/** 특정 아레나 cohort 멤버 (정규화 매칭) — 회장 뷰 범위. */
export async function listArenaCohortMembers(cohort: string): Promise<User[]> {
  const target = normalizeArenaCohort(cohort);
  if (!target) return [];
  const all = await listAllUsers();
  return all.filter(
    (u) => u.role === "trainee" && normalizeArenaCohort(u.cohort) === target,
  );
}
