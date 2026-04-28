/**
 * Layer: repo — 마스터 레지스트리(수강생 ↔ 시트 매핑) I/O.
 */
import { registry } from "@/config";
import { User } from "@/types";
import { readRange, appendRows } from "./sheets-client";

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

// Header helper — 레지스트리 시트를 처음 만들 때 1회 실행.
export async function ensureRegistryHeader(): Promise<void> {
  const reg = registry();
  const existing = await readRange(reg.spreadsheetId, HEADER_RANGE(reg.tab));
  if (existing[0]?.[0] === "email") return;
  await appendRows(reg.spreadsheetId, HEADER_RANGE(reg.tab), [
    ["email", "cohort", "name", "spreadsheetId", "role"],
  ]);
}
