/** Layer: repo — 01 영업관리 B3/C3 프로필 쓰기 (sales.ts 에서 분리 — 500줄 캡). */
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[s()]/.test(tab) ? `'${tab}'` : tab;
}

/**
 * 영업관리 B3/C3에 기수/이름 쓰기.
 * Self-claim 흐름에서 사용 — 시트 템플릿이 빈 상태로 만들어진 경우 web 이 직접 작성.
 */
export async function writeProfile(
  spreadsheetId: string,
  cohort: string,
  name: string,
): Promise<void> {
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!B3:C3`;
  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[cohortNum, name.trim()]] },
  });
}

/** 영업관리 B3(기수)만 쓰기 — 사전등록 때 양식 잔재 기수를 입력 기수로 맞춘다(users-prep). C3 이름은 그대로. */
export async function writeProfileCohort(spreadsheetId: string, cohort: string): Promise<void> {
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(SHEET_RANGES.sales.tab)}!B3`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[String(cohort).replace(/기\s*$/, "").trim()]] },
  });
}
