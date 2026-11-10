/**
 * Layer: repo — ADR-0038 4단계: 시트 없는 수강생(`local:` 번호)의 명단(registry) 쓰기를 DB 에만.
 *
 * 명단 쓰기는 아직 「시트 먼저 → DB 미러」다(users.ts updateUserCell·users-claim.ts claimRegistry 등).
 * 시트 없이 만든 수강생 행은 명단 시트에 없으므로 그 경로가 「없는 사람」으로 실패한다. 각 쓰기 함수는
 * 시트를 보기 **전에** 여기 함수를 먼저 부르고, true(=처리함)면 거기서 끝낸다. 시트에 있는 사람은
 * 여기서 아무것도 안 걸리므로(false) 기존 동작 그대로.
 *
 * 판정 = DB 명단 행 중 D열(spreadsheet_id)이 `local:` 인 행만. 쓰기는 DB 에 **동기**(실패=throw) —
 * 시트 미러처럼 fire-and-forget 하면 실패가 조용히 사라진다(이 행의 정본은 DB 뿐이다).
 */
import { isSheetlessTenantKey } from "@/util/tenant-key";
import { nameMatches } from "./name-match";
import { pickPreferredRow } from "./user-priority";
import { readUserRowsFromDb, registryDbReadEnabled } from "./db/registry-read";
import {
  deleteUserRow,
  rekeyUserRow,
  upsertUserCells,
  upsertUserRow,
  userColumnForLetter,
} from "./db/registry";
import { registryRowFromSheetRow } from "./db/registry-mirror";
import type { User } from "@/types";

type Row = string[];
const keyOf = (r: Row) => ({ email: r[0] ?? "", cohort: r[1] ?? "", name: r[2] ?? "" });
const normCohort = (c: string) => String(c).replace(/기\s*$/, "").trim();

/** DB 명단에서 시트 없는 번호를 가진 행만(시트 A~T 모양). 명단 DB 읽기가 꺼져 있거나 실패하면 []. */
export async function sheetlessRegistryRows(): Promise<Row[]> {
  if (!registryDbReadEnabled()) return [];
  const rows = await readUserRowsFromDb();
  return (rows ?? []).filter((r) => isSheetlessTenantKey(String(r[3] ?? "")));
}

/** 이메일로 고를 행 — 읽기(findUserByEmail)와 같은 우선순위(pickPreferredRow). */
async function pickByEmail(email: string, parse: (r: Row) => User | null): Promise<Row | null> {
  const lc = email.trim().toLowerCase();
  const mine = (await sheetlessRegistryRows()).filter((r) => String(r[0] ?? "").toLowerCase() === lc);
  if (mine.length === 0) return null;
  const parsed = mine.flatMap((r) => {
    const user = parse(r);
    return user ? [{ user, row: r }] : [];
  });
  const crm = parsed.filter((m) => m.user.role === "trainee");
  return pickPreferredRow(crm.length ? crm : parsed)?.row ?? mine[0]!;
}

/** updateUserCell 의 DB 판(한 칸 고치기). 처리했으면 true. A/B/C(자연키)는 행을 새 키로 옮긴다. */
export async function updateSheetlessUserCell(
  email: string,
  colLetter: string,
  value: string,
  parse: (r: Row) => User | null,
): Promise<boolean> {
  const row = await pickByEmail(email, parse);
  if (!row) return false;
  if (colLetter === "A" || colLetter === "B" || colLetter === "C") {
    const field = colLetter === "A" ? "email" : colLetter === "B" ? "cohort" : "name";
    await rekeyUserRow(keyOf(row), registryRowFromSheetRow(row, { [field]: value }));
  } else {
    await upsertUserCells(keyOf(row), { [userColumnForLetter(colLetter)]: value });
  }
  return true;
}

/** deleteUserByEmail 의 DB 판. 처리했으면 true. */
export async function deleteSheetlessUser(email: string, parse: (r: Row) => User | null): Promise<boolean> {
  const row = await pickByEmail(email, parse);
  if (!row) return false;
  await deleteUserRow(keyOf(row));
  return true;
}

/** setUserSortOrders 의 DB 판 — 시트 명단에 없는 이메일만 넘긴다. 처리한 이메일 목록을 돌려준다. */
export async function setSheetlessSortOrders(orders: { email: string; sortOrder: number }[]): Promise<Set<string>> {
  const done = new Set<string>();
  if (orders.length === 0) return done;
  const rows = await sheetlessRegistryRows();
  for (const o of orders) {
    const lc = o.email.trim().toLowerCase();
    const row = rows.find((r) => String(r[0] ?? "").toLowerCase() === lc);
    if (!row || !Number.isFinite(o.sortOrder) || o.sortOrder < 0) continue;
    await upsertUserCells(keyOf(row), { sort_order: Math.floor(o.sortOrder) });
    done.add(lc);
  }
  return done;
}

/**
 * claimRegistry 의 DB 판 — 같은 (기수, 이름)의 시트 없는 행이 있으면 여기서 끝낸다.
 *  ① 이미 이 이메일 행이 있으면 그대로(멱등) ② 사전등록 행(이메일 빈칸)이면 이메일만 채워 옮김
 *  ③ 다른 계정이 쓰는 번호면 같은 번호·같은 날짜로 한 행 더(직원·가족 공유, 케이스 C).
 * 같은 이름의 시트 없는 행이 없으면 false — 시트 경로가 그대로 처리한다.
 */
export async function claimSheetlessRegistry(
  email: string,
  cohort: string,
  name: string,
  role: string,
  status: string,
): Promise<boolean> {
  const lc = email.trim().toLowerCase();
  const matched = (await sheetlessRegistryRows()).filter(
    (r) => normCohort(r[1] ?? "") === normCohort(cohort) && nameMatches(String(r[2] ?? ""), name.trim()),
  );
  if (matched.length === 0) return false;
  if (matched.some((r) => String(r[0] ?? "").toLowerCase() === lc)) return true;
  const prep = matched.find((r) => String(r[0] ?? "").trim() === "");
  if (prep) {
    await rekeyUserRow(keyOf(prep), registryRowFromSheetRow(prep, { email: lc }));
    return true;
  }
  const base = matched[0]!;
  await upsertUserRow(
    registryRowFromSheetRow(base, {
      email: lc, cohort: normCohort(cohort), name: name.trim(), role, status,
      assignedTrainer: "", team: "", sortOrder: 0, driveParentPath: "", feedbackFolderId: "",
      driveLinkStatus: "", memo: "", captainOf: "", gcalToken: "", gcalSettings: "",
    }),
  );
  return true;
}
