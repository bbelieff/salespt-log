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
  return (res.data.values ?? []) as string[][];
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
