/**
 * Layer: repo — users/cohorts Postgres 미러 저수준 함수 (BBE-55, R7 Phase1).
 *
 * 스키마는 마이그레이션 러너(scripts/db-migrate.mjs, BBE-54)가 소유한다 — 여기선
 * sheet_rows(client.ts)처럼 lazy CREATE TABLE 을 하지 않는다. DATABASE_URL 은 있는데
 * 마이그레이션 미적용이면 쿼리가 실패하고, 호출부(registry-mirror.ts)가 fire-and-forget
 * 으로 삼켜 warn 로그만 남긴다 — 정본(시트)엔 영향 0.
 *
 * 자연키 upsert: users=(email,cohort) · cohorts=(label). PK id(uuid)는 INSERT 분기에서만
 * 생성하고, ON CONFLICT UPDATE 분기는 기존 id 를 건드리지 않는다(excluded.<col> 만 SET).
 */
import { randomUUID } from "node:crypto";
import { dbEnabled, getDbPool } from "./client";

export interface RegistryUserRow {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  status: string;
  assignedTrainer: string;
  team: string;
  cohortLabel: string;
  nameLabel: string;
  courseStartISO: string;
  graduationISO: string;
  sortOrder: number;
  driveParentPath: string;
  feedbackFolderId: string;
  driveLinkStatus: string;
  memo: string;
  captainOf: string;
  gcalToken: string;
  gcalSettings: string;
}

const USER_COLUMNS = [
  "email", "cohort", "name", "spreadsheet_id", "role", "status", "assigned_trainer", "team",
  "cohort_label", "name_label", "course_start_iso", "graduation_iso", "sort_order",
  "drive_parent_path", "feedback_folder_id", "drive_link_status", "memo", "captain_of",
  "gcal_token", "gcal_settings",
] as const;
export type UserCellColumn = (typeof USER_COLUMNS)[number];

/** 시트 A~T 열 문자 → users 테이블 컬럼명. 미러 호출부가 이미 알고 있는 colLetter 를
 * 그대로 넘길 수 있게(레지스트리 쓰기 함수들의 기존 파라미터 형태 재사용). */
const USER_COL_BY_LETTER: Record<string, UserCellColumn> = {
  A: "email", B: "cohort", C: "name", D: "spreadsheet_id", E: "role", F: "status",
  G: "assigned_trainer", H: "team", I: "cohort_label", J: "name_label",
  K: "course_start_iso", L: "graduation_iso", M: "sort_order",
  N: "drive_parent_path", O: "feedback_folder_id", P: "drive_link_status",
  Q: "memo", R: "captain_of", S: "gcal_token", T: "gcal_settings",
};
export function userColumnForLetter(letter: string): UserCellColumn {
  const col = USER_COL_BY_LETTER[letter];
  if (!col) throw new Error(`[registry-db] users 알 수 없는 컬럼 letter=${letter}`);
  return col;
}

function toRow(u: RegistryUserRow): (string | number)[] {
  const k = normalizeUserKey(u);
  return [
    k.email, k.cohort, k.name, u.spreadsheetId, u.role, u.status, u.assignedTrainer, u.team,
    u.cohortLabel, u.nameLabel, u.courseStartISO, u.graduationISO, u.sortOrder,
    u.driveParentPath, u.feedbackFolderId, u.driveLinkStatus, u.memo, u.captainOf,
    u.gcalToken, u.gcalSettings,
  ];
}

/** 자연키 컬럼 — ON CONFLICT 대상이자 SET 에서 제외해야 하는 것들(0002 마이그레이션). */
const USER_KEY_COLUMNS: readonly UserCellColumn[] = ["email", "cohort", "name"];

/**
 * 자연키 정규화 — **모든 쓰기가 반드시 통과하는 단일 지점**(적대검증 BLOCKER 수정).
 *
 * 왜 여기냐: 호출부마다 email 을 소문자화하는 곳(users-sort)과 시트 원본 그대로 쓰는 곳
 * (updateUserCell)이 섞여 있어, 같은 시트 행이 `A@B.com` 과 `a@b.com` 두 키로 갈라져
 * **유령 행**이 생겼다. 게다가 backfill 은 upsert 전용이라 그 유령을 영원히 못 지운다.
 * 정규화를 SQL 경계에 두면 producer 가 몇 개든 드리프트가 구조적으로 불가능하다.
 * (`scripts/ops/backfill-registry.mjs` 도 같은 규칙을 복제한다 — 자립 스크립트라 import 불가.)
 *
 * email 은 대소문자 무시(시트·로그인 모두 대소문자 구분 안 함), cohort·name 은 공백만 정리
 * (`parseRow` 가 A~H 를 trim 하지 않아 " 7"·"홍길동 " 같은 값이 실재한다).
 */
export function normalizeUserKey(k: {
  email: string; cohort: string; name: string;
}): { email: string; cohort: string; name: string } {
  return {
    email: k.email.trim().toLowerCase(),
    cohort: k.cohort.trim(),
    name: k.name.trim(),
  };
}

/** 전체 행 upsert — claim/신규등록/append 계열 미러. 자연키 = (email, cohort, name). */
export async function upsertUserRow(u: RegistryUserRow): Promise<void> {
  if (!dbEnabled()) return;
  const setClause = USER_COLUMNS
    .filter((c) => !USER_KEY_COLUMNS.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  await getDbPool().query(
    `insert into users (id, ${USER_COLUMNS.join(", ")})
     values ($1, ${USER_COLUMNS.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (email, cohort, name) do update set ${setClause}, updated_at = now()`,
    [randomUUID(), ...toRow(u)],
  );
}

/** 부분 컬럼 upsert — updateUserCell 류 단일/소수 셀 쓰기 미러. 행이 아직 없으면
 * 자연키 3컬럼 + 주어진 컬럼만으로 최소 행을 만든다(나머지는 스키마 default). */
export async function upsertUserCells(
  key: { email: string; cohort: string; name: string },
  cells: Partial<Record<UserCellColumn, string | number>>,
): Promise<void> {
  if (!dbEnabled()) return;
  const cols = (Object.keys(cells) as UserCellColumn[]).filter(
    (c) => !USER_KEY_COLUMNS.includes(c),
  );
  if (cols.length === 0) return;
  const k = normalizeUserKey(key);
  const insertCols = [...USER_KEY_COLUMNS, ...cols];
  const insertVals: (string | number)[] = [
    k.email, k.cohort, k.name, ...cols.map((c) => cells[c]!),
  ];
  const setClause = cols.map((c) => `${c} = excluded.${c}`).join(", ");
  await getDbPool().query(
    `insert into users (id, ${insertCols.join(", ")})
     values ($1, ${insertCols.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (email, cohort, name) do update set ${setClause}, updated_at = now()`,
    [randomUUID(), ...insertVals],
  );
}

/** 행 삭제 미러 — deleteUserByEmail(deleteDimension) 짝. 시트가 정본이고 아직 아무도
 * DB 를 읽지 않는 단계(R2)라 톰스톤 없이 하드 delete로 시트 상태를 그대로 반영한다. */
export async function deleteUserRow(key: {
  email: string; cohort: string; name: string;
}): Promise<void> {
  if (!dbEnabled()) return;
  const k = normalizeUserKey(key);
  await getDbPool().query(
    `delete from users where email = $1 and cohort = $2 and name = $3`,
    [k.email, k.cohort, k.name],
  );
}

/** (cohort, name) 매칭 users 행 1건 — BBE-70 기수 생성 멱등 판정 전용(prep 행이 이미
 * 있으면 재제출해도 새로 만들지 않는다, `findPrepRowIndex` 의 DB 버전). dbEnabled=false 면
 * null(폴백 없음 — 호출부가 이 라우트 자체를 503 으로 막는다, ADR-0030 §2 "R7-#21 이후 신규
 * 기수는 시트가 없다"). */
export async function findUserByCohortName(
  cohort: string,
  name: string,
): Promise<RegistryUserRow | null> {
  if (!dbEnabled()) return null;
  const c = cohort.trim();
  const n = name.trim();
  const res = await getDbPool().query(
    `select ${USER_COLUMNS.join(", ")} from users where cohort = $1 and name = $2 limit 1`,
    [c, n],
  );
  const row = res.rows[0] as Record<string, string | number> | undefined;
  if (!row) return null;
  return {
    email: String(row.email), cohort: String(row.cohort), name: String(row.name),
    spreadsheetId: String(row.spreadsheet_id), role: String(row.role), status: String(row.status),
    assignedTrainer: String(row.assigned_trainer), team: String(row.team),
    cohortLabel: String(row.cohort_label), nameLabel: String(row.name_label),
    courseStartISO: String(row.course_start_iso), graduationISO: String(row.graduation_iso),
    sortOrder: Number(row.sort_order), driveParentPath: String(row.drive_parent_path),
    feedbackFolderId: String(row.feedback_folder_id), driveLinkStatus: String(row.drive_link_status),
    memo: String(row.memo), captainOf: String(row.captain_of),
    gcalToken: String(row.gcal_token), gcalSettings: String(row.gcal_settings),
  };
}

/** 자연키 변경(A/B/C 열 갱신) — 옛 키 삭제 + 새 행 삽입을 **한 트랜잭션**으로.
 * 나눠 실행하면 삭제만 성공하고 삽입이 실패했을 때 행이 사라진 채로 남는다(적대검증 5-a). */
export async function rekeyUserRow(
  prev: { email: string; cohort: string; name: string },
  next: RegistryUserRow,
): Promise<void> {
  if (!dbEnabled()) return;
  const p = normalizeUserKey(prev);
  const setClause = USER_COLUMNS
    .filter((c) => !USER_KEY_COLUMNS.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  const client = await getDbPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `delete from users where email = $1 and cohort = $2 and name = $3`,
      [p.email, p.cohort, p.name],
    );
    await client.query(
      `insert into users (id, ${USER_COLUMNS.join(", ")})
       values ($1, ${USER_COLUMNS.map((_, i) => `$${i + 2}`).join(", ")})
       on conflict (email, cohort, name) do update set ${setClause}, updated_at = now()`,
      [randomUUID(), ...toRow(next)],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export interface RegistryCohortRow {
  label: string;
  status: string;
  note: string;
  type: string;
  templateSheetId: string;
  rootFolderId: string;
  rosterSheetId: string;
  sheetsFolderId: string;
  companyParentFolderId: string;
  seasonStartISO: string;
}

const COHORT_COLUMNS = [
  "label", "status", "note", "type", "template_sheet_id", "root_folder_id",
  "roster_sheet_id", "sheets_folder_id", "company_parent_folder_id", "season_start_iso",
] as const;
export type CohortCellColumn = (typeof COHORT_COLUMNS)[number];

const COHORT_COL_BY_LETTER: Record<string, CohortCellColumn> = {
  A: "label", B: "status", C: "note", D: "type", E: "template_sheet_id",
  F: "root_folder_id", G: "roster_sheet_id", H: "sheets_folder_id",
  I: "company_parent_folder_id", J: "season_start_iso",
};
export function cohortColumnForLetter(letter: string): CohortCellColumn {
  const col = COHORT_COL_BY_LETTER[letter];
  if (!col) throw new Error(`[registry-db] cohorts 알 수 없는 컬럼 letter=${letter}`);
  return col;
}

export async function upsertCohortRow(c: RegistryCohortRow): Promise<void> {
  if (!dbEnabled()) return;
  const setClause = COHORT_COLUMNS.filter((col) => col !== "label")
    .map((col) => `${col} = excluded.${col}`)
    .join(", ");
  await getDbPool().query(
    `insert into cohorts (id, ${COHORT_COLUMNS.join(", ")})
     values ($1, ${COHORT_COLUMNS.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (label) do update set ${setClause}, updated_at = now()`,
    [randomUUID(), c.label, c.status, c.note, c.type, c.templateSheetId, c.rootFolderId,
      c.rosterSheetId, c.sheetsFolderId, c.companyParentFolderId, c.seasonStartISO],
  );
}

/** 부분 컬럼 upsert — setCohortStatus(B만)·upsertCohortConfig(D~J)·writeSeasonStartRaw(J만) 공용.
 * 행이 없으면 label + 주어진 컬럼만으로 최소 행(status/type 은 스키마 default 'active'/'cohort'). */
export async function upsertCohortCells(
  label: string,
  cells: Partial<Record<CohortCellColumn, string>>,
): Promise<void> {
  if (!dbEnabled()) return;
  const cols = (Object.keys(cells) as CohortCellColumn[]).filter((c) => c !== "label");
  if (cols.length === 0) return;
  const insertCols = ["label", ...cols];
  const insertVals: string[] = [label, ...cols.map((c) => cells[c]!)];
  const setClause = cols.map((c) => `${c} = excluded.${c}`).join(", ");
  await getDbPool().query(
    `insert into cohorts (id, ${insertCols.join(", ")})
     values ($1, ${insertCols.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (label) do update set ${setClause}, updated_at = now()`,
    [randomUUID(), ...insertVals],
  );
}
