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
  syncFeeFromContract,
  updateUserFields,
} from "@/repo/contract-payment";
import type { ContractPayment } from "@/types";
import { SHEET_RANGES } from "@/config";
import { sheetsClient } from "@/repo/sheets-client";
import { findByDate, updateMeeting } from "@/repo/meetings";

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

/**
 * 04 업체관리의 수임비 수정이 02 계약수납관리!E에 sync되도록.
 * (계약일+업체명) 매칭 row 없으면 null — 호출자가 처리.
 */
export async function syncContractFee(
  email: string,
  data: { 계약일: string; 업체명: string; 수임비: number },
): Promise<{ row: number } | null> {
  const spreadsheetId = await resolveSheet(email);
  return syncFeeFromContract(spreadsheetId, data);
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

/**
 * row 삭제 + 매칭 미팅 cascade 되돌리기 (2026-05-17 [3]).
 *
 * 흐름:
 *  1) 삭제 전 row 의 (계약일, 업체명) 읽기 (cascade key)
 *  2) clearRow
 *  3) 04 업체관리에서 (미팅날짜=계약일, 업체명=업체명) 매칭 미팅 찾기
 *     - 상태=계약 인 row 만 revert (계약 외 상태는 손대지 않음)
 *  4) 미팅 patch: 상태=예약, 수임비=0, 계약조건="", 계약여부=false
 *
 * 반환: cascade 결과 + 바로가기 정보 (matching meeting id/예약일).
 */
export async function removeContractPaymentWithCascade(
  email: string,
  row: number,
): Promise<{
  cascade: string;
  meetingId: string | null;
  미팅날짜: string | null;
}> {
  const spreadsheetId = await resolveSheet(email);

  // 1) 삭제 전 row 의 (계약일, 업체명) 읽기 — cascade key
  const { tab } = SHEET_RANGES.contractPayment;
  const tabRef = /[\s()]/.test(tab) ? `'${tab}'` : tab;
  const linkRes = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef}!C${row}:D${row}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const linkRow = linkRes.data.values?.[0] ?? [];
  const 계약일Raw = linkRow[0];
  const 업체명 = String(linkRow[1] ?? "").trim();
  // 계약일 직렬→ISO 변환은 readAll 로직과 동일하지 않으면 매칭 실패 → 직접 변환
  const 계약일 = serialOrISO(계약일Raw);

  // 2) clearRow
  await clearRow(spreadsheetId, row);

  // 3) 매칭 미팅 찾기
  if (!계약일 || !업체명) {
    return {
      cascade: "row 의 계약일/업체명 비어있어 cascade 생략",
      meetingId: null,
      미팅날짜: null,
    };
  }
  const meetings = await findByDate(spreadsheetId, 계약일, "meeting");
  const target = meetings.find(
    (m) => m.업체명.trim() === 업체명 && m.상태 === "계약",
  );
  if (!target) {
    return {
      cascade: `매칭 계약 미팅 없음 (${계약일} / ${업체명}) — 미팅 상태 변경 안 함`,
      meetingId: null,
      미팅날짜: 계약일,
    };
  }

  // 4) 미팅 revert
  await updateMeeting(spreadsheetId, target.id, {
    상태: "예약",
    계약여부: false,
    수임비: 0,
    계약조건: "",
  });

  return {
    cascade: `미팅 ${target.업체명} (${계약일}) 계약 → 예약 복원`,
    meetingId: target.id,
    미팅날짜: 계약일,
  };
}

/** 시트 직렬값/문자열 → ISO 변환 (계약일 cascade 매칭용). */
function serialOrISO(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (typeof v === "number") {
    // Google Sheets 직렬 (1899-12-30 epoch).
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return "";
}
