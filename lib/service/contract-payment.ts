/**
 * Layer: service — 계약수납 유스케이스 (PR 11).
 *
 * 시트 02 계약수납관리:
 *   - 일정·계약 탭에서 계약 액션 시 row 자동 생성 (appendFromContract)
 *   - 계약수납탭에서 사용자가 F~AA 입력 → patch (updateUserFields)
 *   - 삭제 → clearRow
 */
import { randomUUID } from "node:crypto";
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

// isCarryoverContract(이월 판정 단일 결정점)은 클라이언트(실무수납 UI)도 써야 하므로
// @/types 로 이전(googleapis 비의존). 여기선 @/types 재노출만.
export { isCarryoverContract } from "@/types";

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
  // 출발 미팅 lookup — 이월 깃발 상속(§3) + 06 스냅샷 양쪽에 사용.
  let m;
  try {
    const meetings = await findByDate(spreadsheetId, data.계약일, "meeting");
    m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
  } catch {
    m = undefined;
  }
  // 이월 미팅에서 생긴 계약 = 02 행도 "이월"(집계 제외, 출발 미팅 깃발 상속).
  const carryover =
    m?.구분 === "이월" ? { 원본행id: m.이월원본행id || m.id } : undefined;
  const result = await appendFromContract(spreadsheetId, data, carryover);
  // 06 업체정보 스냅샷 — 계약 고객 누적 (consultation-log §1-2). 실패해도 계약 성공(warn).
  try {
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

/**
 * 이전(아레나 시작 전) 계약업체 직접 등록 — 실무·수납 관리용 (arena-start-revenue-split §A).
 * 미팅 출발이 아니므로 02 에 직접 append + **구분=이월 강제**(아레나 비집계).
 * 멱등키 = `prior:<uuid>`(랜덤 — 매 등록이 새 행). 폼 전체(수임비·슬롯·서류)는
 * appendFromContract(C/D/E+AI/AJ) 후 updateUserFields(F~AH)로 반영. §2.5 가드는
 * 두 repo 함수가 각자 보유(append=빈 행, updateUserFields=사용자영역).
 */
export async function addPriorContract(
  email: string,
  cp: ContractPayment,
): Promise<{ row: number }> {
  const spreadsheetId = await resolveSheet(email);
  const { row } = await appendFromContract(
    spreadsheetId,
    { 계약일: cp.계약일, 업체명: cp.업체명, 수임비: cp.수임비 },
    { 원본행id: `prior:${randomUUID()}` }, // 직접 등록 → 이월 깃발(AI=이월) 강제
  );
  // 슬롯·서류·메모(F~AH) 반영 — 폼에서 입력했으면 함께 저장.
  await updateUserFields(spreadsheetId, { ...cp, row });
  return { row };
}

/** CompanyInfo 에 채워진 값이 하나라도 있는지(전부 빈 문자열·빈 커스텀이면 false). */
function hasCompanyInfo(ci: CompanyInfo | null | undefined): boolean {
  if (!ci) return false;
  for (const [k, v] of Object.entries(ci)) {
    if (k === "커스텀") {
      const c = v as CompanyInfo["커스텀"];
      if (c && (Object.keys(c.업체 ?? {}).length || Object.keys(c.대표자 ?? {}).length))
        return true;
      continue;
    }
    if (typeof v === "string" && v.trim() !== "") return true;
  }
  return false;
}

/**
 * 계약 키(계약일|업체명)로 업체정보 읽기 — payment 카드용.
 * 06 우선, 06 이 없거나 비면 **04 미팅 fallback**(권위 소스): 계약일(=미팅날짜) 매칭 미팅의
 * 업체정보. 계약 후 미팅에서 업체정보를 채워도 06 스냅샷이 비어 빈 값 나오던 문제 해결.
 */
export async function loadCompanyInfoByContract(
  email: string,
  data: { 계약일: string; 업체명: string },
): Promise<CompanyInfo | null> {
  const spreadsheetId = await resolveSheet(email);
  const archived = await readCompanyInfoArchiveRow(spreadsheetId, data.계약일, data.업체명);
  if (hasCompanyInfo(archived)) return archived;
  try {
    const meetings = await findByDate(spreadsheetId, data.계약일, "meeting");
    const m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
    if (m?.업체정보 && hasCompanyInfo(m.업체정보)) return m.업체정보;
  } catch (e) {
    console.warn(
      "[contract-payment] 04 업체정보 fallback 실패:",
      e instanceof Error ? e.message : e,
    );
  }
  return archived; // 06·04 둘 다 없으면 06값(null 가능)
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
