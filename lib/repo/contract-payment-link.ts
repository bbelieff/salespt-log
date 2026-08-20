/**
 * Layer: repo — 02 계약행의 **링크키(계약일·업체명) 기반** 쓰기.
 *
 * 미팅(04) 화면이 계약을 지우거나 계약일·업체명을 고칠 때 쓰는 두 함수. `contract-payment.ts` 가
 * 500줄 캡에 닿아 분리했다(R3-3 잔여 PR — PR-1 리뷰 후속⑤가 예고한 split). 공개 API 는 그대로
 * `@/repo/contract-payment` 에서 재수출되므로 호출부·기존 테스트 모킹 경로는 바뀌지 않는다.
 */
import { sheetsClient } from "./sheets-client";
import { clearRow, findRowByLink, resolveLayout, tabRef } from "./contract-payment";
import { type ContractWriteOpts, persistContractRow } from "./db/contracts-clear";
import { queueContractRowSync } from "./contract-sheet-sync";

/**
 * (계약일, 업체명) 매칭 row clear. 미팅 계약 되돌리기 cascade 용 (2026-05-17 [2a]).
 * 매칭되는 row 없으면 null 반환, 있으면 clearRow 후 row 번호 반환.
 *
 * BBE-246: clearRow 자체가 opts.syncDb 분기를 전담(DB 동기 정본 + 시트 비동기 수렴잡) —
 * 예전엔 여기서 DB 를 먼저 확정한 뒤 별도로 clearRow(시트만)를 불러 순서를 뒤집었지만,
 * 파일럿 경로는 이제 clearRow 가 시트를 아예 동기로 건드리지 않으므로 그 순서 문제 자체가
 * 소멸했다(시트가 "먼저/나중" 일 수가 없다 — 큐로 넘어갈 뿐).
 */
export async function clearRowByLink(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
  opts?: ContractWriteOpts,
): Promise<number | null> {
  const row = await findRowByLink(spreadsheetId, { 계약일, 업체명 });
  if (row === null) return null;
  await clearRow(spreadsheetId, row, opts);
  return row;
}

/**
 * (계약일, 업체명) link key 갱신 — 미팅 수정 시 계약카드 sync (2026-05-19 Phase 3).
 * old 매칭 row 찾아 C(계약일)/D(업체명) 새 값으로 update. 없으면 null.
 *
 * BBE-246: 파일럿(opts.syncDb) = DB 동기 정본 먼저, 시트는 비동기 수렴잡 큐(요청 경로에서
 * 시트 API 호출 제거). 예전 "시트-first" 주석(치유 가능성 논거)은 시트를 동기로 안 건드리는
 * 이 경로엔 더 이상 적용되지 않는다 — 비파일럿(R2)은 그대로 시트-first 유지.
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
  const payload = { 계약일: next.계약일, 업체명: next.업체명 };
  if (opts?.syncDb) {
    await persistContractRow(spreadsheetId, row, payload, opts);
    queueContractRowSync(spreadsheetId, row);
    return row;
  }
  const { tab } = await resolveLayout(spreadsheetId);
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(tab)}!C${row}:D${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[next.계약일, next.업체명]] },
  });
  await persistContractRow(spreadsheetId, row, payload, opts); // R2
  return row;
}
