/**
 * Layer: repo — Drive 연결 Postgres 원자 업데이트 (drive-auto-link 2026-09-24).
 * users.ts 와 순환 없도록 key/data 만 받는다. findUserByEmail 은 호출부(users.ts)가 한다.
 */
import { getDbPool } from "./db/client";
import { normalizeUserKey } from "./db/registry";

export interface DriveLinkKey {
  email: string;
  cohort: string;
  name: string;
}

export interface DriveLinkData {
  driveParentPath?: string;
  feedbackFolderId?: string;
  driveLinkStatus?: string;
}

const COLUMN_BY_FIELD = {
  driveParentPath: "drive_parent_path",
  feedbackFolderId: "feedback_folder_id",
  driveLinkStatus: "drive_link_status",
} as const;

/**
 * 제공된 drive 필드만 + updated_at 을 한 UPDATE 로 쓴다.
 * 정규화된 기존 자연키에 정확히 1행 맞아야 하며, 아니면 throw(DB 실패는 Sheets 폴백 금지).
 */
export async function updateDriveLinkInDb(
  key: DriveLinkKey,
  data: DriveLinkData,
): Promise<void> {
  const k = normalizeUserKey(key);
  const sets: string[] = [];
  const vals: string[] = [];
  let i = 1;
  for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
    const v = data[field as keyof DriveLinkData];
    if (v === undefined) continue;
    sets.push(`${column} = $${i++}`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = now()");
  vals.push(k.email, k.cohort, k.name);
  const res = await getDbPool().query(
    `update users set ${sets.join(", ")} where email = $${i++} and cohort = $${i++} and name = $${i++}`,
    vals,
  );
  if (res.rowCount !== 1) {
    throw new Error(`[users-drive-db] drive link update affected ${res.rowCount ?? 0} rows`);
  }
}
