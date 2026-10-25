/**
 * Layer: repo — 한 수강생의 업체정보(06 company_archive 미러) 전부를 한 번에 읽는다(2026-10-26 맞춤공고 4단계).
 * 업체마다 따로 읽으면 실무/수납 목록 칩(공고 N)에 계약 수만큼 질의가 나간다 — 한 번에 읽어 계약ref → 업체정보.
 */
import type { CompanyInfo } from "@/types";
import { companyInfoFromDbPayload } from "./read-daily";
import { dbEnabled, ensureSchema, getDbPool } from "./client";

export async function readCompanyInfosFromDb(spreadsheetId: string): Promise<Map<string, CompanyInfo>> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select row_key, payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'company_archive'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );
  const out = new Map<string, CompanyInfo>();
  for (const r of res.rows as { row_key: string; payload: Record<string, unknown> }[]) {
    const ci = companyInfoFromDbPayload(r.payload);
    if (ci) out.set(r.row_key, ci);
  }
  return out;
}
