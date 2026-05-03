/**
 * Layer: service — 계약수납 유스케이스 (PR 11).
 *
 * 시트 02 계약수납관리:
 *   - 일정·계약 탭에서 계약 액션 시 row 자동 생성 (appendFromContract)
 *   - 계약수납탭에서 사용자가 F~AA 입력 → patch (updateUserFields)
 *   - 삭제 → clearRow
 */
import { findUserByEmail } from "@/repo/users";
import {
  appendFromContract,
  clearRow,
  readAll,
  updateUserFields,
} from "@/repo/contract-payment";
import type { ContractPayment } from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contract-payment] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

/** 모든 계약수납 row 조회. */
export async function loadContractPayments(
  email: string,
): Promise<ContractPayment[]> {
  const spreadsheetId = await resolveSheet(email);
  return readAll(spreadsheetId);
}

/**
 * 일정·계약 탭에서 계약 액션 발생 시 호출.
 * 04 업체관리에서 채워진 자동 연동 필드(계약일/업체명/수임비)로 row append.
 */
export async function addFromContract(
  email: string,
  data: { 계약일: string; 업체명: string; 수임비: number },
): Promise<{ row: number }> {
  const spreadsheetId = await resolveSheet(email);
  return appendFromContract(spreadsheetId, data);
}

/** 사용자 입력 영역(F~AA) patch. */
export async function patchContractPayment(
  email: string,
  cp: ContractPayment,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await updateUserFields(spreadsheetId, cp);
}

/** row 통째로 clear. */
export async function removeContractPayment(
  email: string,
  row: number,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await clearRow(spreadsheetId, row);
}
