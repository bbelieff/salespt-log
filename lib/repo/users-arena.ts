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

/** 특정 아레나 cohort 멤버 (정규화 매칭) — 회장 뷰 범위. */
export async function listArenaCohortMembers(cohort: string): Promise<User[]> {
  const target = normalizeArenaCohort(cohort);
  if (!target) return [];
  const all = await listAllUsers();
  return all.filter(
    (u) => u.role === "trainee" && normalizeArenaCohort(u.cohort) === target,
  );
}
