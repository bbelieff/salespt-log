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
  readContractCascadeKey,
  syncFeeFromContract,
  updateUserFields,
} from "@/repo/contract-payment";
import type { CompanyInfo, ContractPayment } from "@/types";
import { findByDate, updateMeeting } from "@/repo/meetings";
import {
  readCompanyInfoArchiveRow,
  upsertCompanyInfoArchive,
} from "@/repo/company-info-archive";

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
  const result = await appendFromContract(spreadsheetId, data);
  // 06 업체정보 스냅샷 — 계약 고객 누적 (consultation-log §1-2). 그 미팅의 04
  // 업체정보(T~AN)를 복사해 1행 upsert. 실패해도 계약 액션은 성공(warn only).
  try {
    const meetings = await findByDate(spreadsheetId, data.계약일, "meeting");
    const m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
    await upsertCompanyInfoArchive(spreadsheetId, {
      업체명: data.업체명,
      계약일: data.계약일,
      업체정보: m?.업체정보,
    });
  } catch (e) {
    console.warn(
      "[contract-payment] 06 업체정보 스냅샷 실패 (계약 자체는 성공):",
      e instanceof Error ? e.message : e,
    );
  }
  return result;
}

/** 계약 키(계약일|업체명)로 업체정보 읽기 — payment 카드용. 06 에서 read. */
export async function loadCompanyInfoByContract(
  email: string,
  data: { 계약일: string; 업체명: string },
): Promise<CompanyInfo | null> {
  const spreadsheetId = await resolveSheet(email);
  return readCompanyInfoArchiveRow(spreadsheetId, data.계약일, data.업체명);
}

/**
 * 계약 키로 업체정보 저장 — payment 편집용 (consultation-log §3-1).
 * 04 원본(매칭 미팅의 T~AN) + 06 둘 다 갱신. 04 매칭 미팅 없으면 06 만.
 */
export async function saveCompanyInfoByContract(
  email: string,
  data: { 계약일: string; 업체명: string; 업체정보: CompanyInfo },
): Promise<{ meetingUpdated: boolean }> {
  const spreadsheetId = await resolveSheet(email);
  let meetingUpdated = false;
  const meetings = await findByDate(spreadsheetId, data.계약일, "meeting");
  const m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
  if (m) {
    await updateMeeting(spreadsheetId, m.id, { 업체정보: data.업체정보 });
    meetingUpdated = true;
  }
  await upsertCompanyInfoArchive(spreadsheetId, data);
  return { meetingUpdated };
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

  // 1) 삭제 전 row 의 (계약일, 업체명) 읽기 — cascade key.
  // resolveLayout 경유로 6기 `02 계약관리` 탭 alias 자동 처리 (bugfix 2026-06).
  const { 계약일, 업체명 } = await readContractCascadeKey(spreadsheetId, row);

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
