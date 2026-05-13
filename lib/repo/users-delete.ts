/**
 * Layer: repo — Registry row 물리 삭제 + 매핑 cleanup (users.ts 에서 분리, 500줄 cap).
 *
 * 함수:
 *   - deleteUserByEmail: Sheets batchUpdate deleteDimension 으로 row 물리 삭제.
 *     (sheetId 메타 조회 + cache 무효화)
 *   - removeTraineeCompletely: deleteUserByEmail 의 trainee 전용 alias.
 *   - removeTrainerCompletely: trainee 의 G 컬럼에서 trainer email 제거 후 row 삭제.
 *
 * 모두 admin 전용. 호출 후 invalidateRegistry().
 */
import { registry } from "@/config";
import { readRange, sheetsClient } from "./sheets-client";
import {
  invalidateRegistry,
  listAllUsers,
  parseAssignedTrainers,
  setTraineeAssignments,
} from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:M`;

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
 * Admin 전용: trainee 완전 퇴출 — registry row 물리 삭제.
 * 트레이너 퇴출과 달리 매핑 cleanup 필요 없음 (trainee.G 는 trainee 자신의
 * 컬럼이라 다른 row 가 참조하지 않음).
 *
 * 보통 유보 상태에서만 호출 (UI 가드) — 정규 명단에서 바로 삭제 방지 의도.
 * 단, 시트 자체는 건드리지 않음 (Google 시트 권한·데이터는 그대로).
 */
export async function removeTraineeCompletely(email: string): Promise<void> {
  await deleteUserByEmail(email);
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
