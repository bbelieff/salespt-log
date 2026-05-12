/**
 * Layer: repo — Google Sheets 전용.
 *
 * 가드레일 (구조 테스트가 강제):
 *   • googleapis 는 오직 lib/repo/ 에서만 import.
 *   • 셀 단위 update 금지 — batchUpdate / values.update / values.append 사용.
 *   • 반환은 dict 가 아니라 lib/types 의 Zod 모델.
 */
import { google, type sheets_v4 } from "googleapis";
import { serviceAccount } from "@/config";

let cached: sheets_v4.Sheets | null = null;

export function sheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;
  const sa = serviceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cached = google.sheets({ version: "v4", auth });
  return cached;
}

export async function readRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  // **CRITICAL** — Sheets API + UNFORMATTED_VALUE 는 셀 타입 그대로 반환
  // (숫자 셀 → JS number, boolean 셀 → JS boolean). 함수 반환 타입은 string[][]
  // 인데 실제로는 (string|number|boolean|null)[][] 였음. 2026-05-13 사고:
  // registry 의 cohort 컬럼이 "7" 입력해도 시트가 자동으로 number 7 로 형변환 →
  // parseRow 의 `cohort: r[1] ?? ""` 가 number 그대로 Zod z.string() 에 전달 →
  // 검증 실패 → findUserByEmail null → /claim 무한루프. 경계에서 강제 정규화
  // (모든 셀을 string 으로) 해서 호출자가 raw 타입 만질 일 없게 함. null/undefined
  // 는 빈 문자열로 흡수.
  return (res.data.values ?? []).map((row) =>
    row.map((cell) => (cell == null ? "" : String(cell))),
  );
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean)[][],
): Promise<void> {
  if (rows.length === 0) return;
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}
