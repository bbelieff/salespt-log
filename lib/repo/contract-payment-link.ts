/**
 * Layer: repo — 02 계약행의 **링크키(계약일·업체명) 기반** 쓰기.
 *
 * 미팅(04) 화면이 계약을 지우거나 계약일·업체명을 고칠 때 쓰는 두 함수. `contract-payment.ts` 가
 * 500줄 캡에 닿아 분리했다(R3-3 잔여 PR — PR-1 리뷰 후속⑤가 예고한 split). 공개 API 는 그대로
 * `@/repo/contract-payment` 에서 재수출되므로 호출부·기존 테스트 모킹 경로는 바뀌지 않는다.
 */
import { sheetsClient } from "./sheets-client";
import { clearRow, findRowByLink, resolveLayout, tabRef } from "./contract-payment";
import {
  clearContractRowInDbSync,
  type ContractWriteOpts,
  persistContractRow,
} from "./db/contracts-clear";

/**
 * (계약일, 업체명) 매칭 row clear. 미팅 계약 되돌리기 cascade 용 (2026-05-17 [2a]).
 * 매칭되는 row 없으면 null 반환, 있으면 clearRow 후 row 번호 반환.
 */
export async function clearRowByLink(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
  opts?: ContractWriteOpts,
): Promise<number | null> {
  const row = await findRowByLink(spreadsheetId, { 계약일, 업체명 });
  if (row === null) return null;
  if (opts?.syncDb) {
    // R3-3 잔여: 파일럿은 **DB 를 먼저 확정**한 뒤 시트를 지운다(clearRow 의 시트-first 와 반대).
    // 근거: 이 함수의 키는 (계약일, 업체명) 뿐이라 시트를 먼저 지우면 findRowByLink 가 다음 시도에서
    // 행을 못 찾는다 → DB 동기 실패 시 유령 계약이 **치유 불가능**해진다. DB 먼저 = 실패해도 시트
    // 무변경(재시도 성립), 성공 후 시트 실패해도 정본은 정확하고 재시도가 수렴.
    await clearContractRowInDbSync(spreadsheetId, row);
    await clearRow(spreadsheetId, row); // 시트 반영(미러 재마킹은 _cleared 멱등이라 무해)
  } else {
    await clearRow(spreadsheetId, row); // 비파일럿=시트 정본 + async 미러(기존 불변)
  }
  return row;
}

/**
 * (계약일, 업체명) link key 갱신 — 미팅 수정 시 계약카드 sync (2026-05-19 Phase 3).
 * old 매칭 row 찾아 C(계약일)/D(업체명) 새 값으로 update. 없으면 null.
 *
 * 순서는 시트-first 유지: 호출부가 `meetingId` 를 함께 넘기고 findRowByLink 가 id 를 우선 매칭하므로,
 * 시트가 새 값으로 바뀐 뒤 재시도해도 같은 행을 찾는다(clearRowByLink 와 달리 치유 가능).
 */
export async function updateLinkFields(
  spreadsheetId: string,
  old: { 계약일: string; 업체명: string; meetingId?: string },
  next: { 계약일: string; 업체명: string },
  opts?: ContractWriteOpts,
): Promise<number | null> {
  const row = await findRowByLink(spreadsheetId, {
    meetingId: old.meetingId,
    계약일: old.계약일,
    업체명: old.업체명,
  });
  if (row === null) return null;
  const { tab } = await resolveLayout(spreadsheetId);
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(tab)}!C${row}:D${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[next.계약일, next.업체명]] },
  });
  await persistContractRow(spreadsheetId, row, { 계약일: next.계약일, 업체명: next.업체명 }, opts); // R3-3 dual-sync
  return row;
}
