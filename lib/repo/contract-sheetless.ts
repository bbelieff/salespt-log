/**
 * Layer: repo — ADR-0038 시트 없는 수강생(`local:` 번호)의 02 계약 행 추가/연결.
 *
 * 시트 수강생은 02 탭에서 같은 미팅 행을 찾고(findRowByLink) 없으면 첫 빈 행을 골라 번호를 정한다
 * (appendFromContract). 시트 없는 수강생은 같은 일을 DB 정본에서 한다:
 *  · 같은 미팅(연결 미팅 id) 행이 있으면 그 행 갱신 — 재시도해도 계약 행은 하나.
 *  · 없으면 **지금까지 쓴 적 없는 번호**(지운 행 포함 최대 번호 + 1) — 지운 행 번호를 다시 쓰면
 *    jsonb 병합으로 지운 계약의 수납·서류 값이 새 계약에 되살아난다.
 *  · 번호 고르기와 저장은 같은 잠금 안에서(동시 추가 두 건이 같은 번호를 집지 않게).
 */
import { SHEET_RANGES } from "@/config";
import { isManualContractLink } from "@/util/contract-link";
import { getDbPool } from "./db/client";
import { persistContractRow } from "./db/contracts-clear";
import { readContractsFromDb } from "./db/read-daily";
import { withScopeLock } from "./db/db-append-idempotency";
import type { IdemPool } from "./db/expense-idempotency";

type ContractAppend = { 계약일: string; 업체명: string; 수임비: number; meetingId?: string };

export async function appendSheetlessContract(
  spreadsheetId: string,
  data: ContractAppend,
  carryover: { 원본행id: string } | undefined,
  dateCompanyFallback: boolean,
): Promise<{ row: number }> {
  const pool = getDbPool() as unknown as IdemPool;
  const payload = {
    _cleared: false, 계약일: data.계약일, 업체명: data.업체명, 수임비: data.수임비,
    ...(data.meetingId ? { meetingId: data.meetingId } : {}),
    ...(carryover ? { 구분: "이월", 원본행id: carryover.원본행id } : {}),
  };
  return withScopeLock(pool, spreadsheetId, "contracts", async (db) => {
    const live = await readContractsFromDb(spreadsheetId);
    let existing = data.meetingId ? live.find((c) => c.linkedMeetingId === data.meetingId) : undefined;
    if (!existing && dateCompanyFallback) {
      existing = live.find((c) =>
        !isManualContractLink(c.linkedMeetingId ?? "") &&
        c.계약일 === data.계약일 && c.업체명.trim() === data.업체명.trim());
    }
    let row = existing?.row;
    if (row === undefined) {
      const used = await db.query(
        `select row_key from sheet_rows where spreadsheet_id = $1 and tab = 'contracts'`,
        [spreadsheetId],
      );
      const max = (used.rows as { row_key: string }[])
        .map((r) => Number(r.row_key.replace(/^r/, "")))
        .filter(Number.isFinite)
        .reduce((a, b) => Math.max(a, b), SHEET_RANGES.contractPayment.firstDataRow - 1);
      row = max + 1;
    }
    await persistContractRow(spreadsheetId, row, payload, { syncDb: true });
    return { row };
  });
}
