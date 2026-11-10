/**
 * Layer: repo — ADR-0038 시트 없는 수강생(`local:` 번호)의 06 업체정보 키 이동(개명·계약일 변경).
 *
 * 시트 수강생은 rename 이 06 시트의 A~D 키만 바꾸고 E~BR 업체정보는 시트에 남긴다(DB 새 키 행은
 * 키필드만 — company-archive-sync.ts renameKeyOnlyPayload). 시트 없는 수강생은 남겨 둘 시트가 없으므로
 * 업체정보를 **DB 새 키로 통째로 옮긴 뒤** 옛 키를 지운다(새 키 먼저 — 중간 실패해도 정보가 사라지지 않게).
 */
import { companyContractRef } from "./company-info-archive";
import {
  persistCompanyArchiveRow,
  persistCompanyArchiveRename,
  readCompanyArchiveRowPayload,
} from "./db/company-archive-sync";

export async function renameSheetlessCompanyInfo(
  spreadsheetId: string,
  oldKey: { 계약일: string; 업체명: string },
  next: { 계약일: string; 업체명: string },
): Promise<{ moved: boolean }> {
  const oldRef = companyContractRef(oldKey.계약일, oldKey.업체명);
  const old = await readCompanyArchiveRowPayload(spreadsheetId, oldRef);
  if (!old || old._cleared === true) return { moved: false };
  const nextRef = companyContractRef(next.계약일, next.업체명);
  await persistCompanyArchiveRow(
    spreadsheetId,
    nextRef,
    { ...old, _cleared: false, 업체명: next.업체명.trim(), 계약일: next.계약일 },
    { syncDb: true },
  );
  // 옛 키만 지운다(새 키는 위에서 통째로 썼다 — rename 의 키필드 병합이 내용을 덮지 않게 같은 값으로).
  await persistCompanyArchiveRename(
    spreadsheetId,
    oldRef,
    { rowKey: nextRef, payload: { ...old, _cleared: false, 업체명: next.업체명.trim(), 계약일: next.계약일 } },
    { syncDb: true },
  );
  return { moved: true };
}
