/**
 * Layer: repo — Admin 사전 등록 (prep row) — users.ts 에서 분리 (500줄 cap).
 *
 * 사용처: /admin/users 의 "신규 수강생 사전 등록" 폼 → POST /api/admin/add-trainee-prep.
 * 효과:
 *   - 시트 URL 받아서 spreadsheetId 추출 + (cohort, name) prep row 생성.
 *   - 본인이 /claim 시 (cohort, name) 매칭 → email 만 채워서 즉시 active.
 *   - Drive 시트 이름 일치 의존성 없음 — admin 이 명시적으로 매핑.
 */
import { registry } from "@/config";
import { readRange, appendRows, sheetsClient } from "./sheets-client";
import { invalidateRegistry } from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:L`;

/**
 * 시트 URL / open URL / raw ID 어떤 형태든 spreadsheetId 추출.
 * `https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing` 같은 URL OK.
 * 매칭 실패면 입력값 그대로 반환 (호출 측이 길이·문자 검증).
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1]!;
  return trimmed;
}

/**
 * (cohort, name) row 가 있으면 D 컬럼만 update, 없으면 신규 append.
 *  - email 은 빈 채로 둠 (self-claim 시 채워짐).
 *  - status="active" — 본인 매칭 시 즉시 활성.
 */
export async function addTraineePrepRow(
  cohort: string,
  name: string,
  spreadsheetId: string,
  assignedTrainer = "",
): Promise<{ created: boolean }> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  const cohortNorm = String(cohort).replace(/기\s*$/, "").trim();
  const cleanName = name.trim();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const c = String(r[1] ?? "").replace(/기\s*$/, "").trim();
    const n = String(r[2] ?? "").trim();
    if (c === cohortNorm && n === cleanName) {
      const sheetRow = i + 2;
      await sheetsClient().spreadsheets.values.update({
        spreadsheetId: reg.spreadsheetId,
        range: `${reg.tab}!D${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[spreadsheetId]] },
      });
      invalidateRegistry();
      return { created: false };
    }
  }
  await appendRows(reg.spreadsheetId, DATA_RANGE(reg.tab), [
    ["", cohortNorm, cleanName, spreadsheetId, "trainee", "active", assignedTrainer, "", "", "", "", ""],
  ]);
  invalidateRegistry();
  return { created: true };
}
