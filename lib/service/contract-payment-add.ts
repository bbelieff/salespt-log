/**
 * Layer: service — 계약수납 "추가" 유스케이스 (contract-payment.ts 500줄 캡으로 분리, R3-3 선례대로 재수출).
 * addFromContract(미팅에서 계약) · addPriorContract(이전 계약 직접등록) — 둘 다 append 경로.
 */
import { randomUUID } from "node:crypto";
import {
  appendFromContract,
  readAll,
  updateUserFields,
} from "@/repo/contract-payment";
import type { ContractPayment } from "@/types";
import { findMeetingsByDateRecord } from "./meetings-write";
import { upsertCompanyInfoArchive } from "@/repo/company-info-archive";
import { resolveCtx, resolveSheetWithSyncDb } from "./contract-payment";

/**
 * 일정·계약 탭에서 계약 액션 발생 시 호출.
 * 04 업체관리에서 채워진 자동 연동 필드(계약일/업체명/수임비)로 row append.
 */
export async function addFromContract(
  email: string,
  data: { 계약일: string; 업체명: string; 수임비: number },
): Promise<{ row: number }> {
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  // 출발 미팅 lookup — 이월 깃발 상속(§3) + 06 스냅샷 양쪽에 사용.
  // R3-2: 파일럿은 DB — 시트 미러 lag 로 방금 계약된 미팅을 못 찾아 AK 링크·이월 깃발이
  // 빠지는 split-brain 방지(읽기 동반 전환 원칙).
  let m;
  try {
    const meetings = await findMeetingsByDateRecord(ctx, data.계약일, "meeting");
    m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
  } catch {
    m = undefined;
  }
  // 이월 미팅에서 생긴 계약 = 02 행도 "이월"(집계 제외, 출발 미팅 깃발 상속).
  const carryover =
    m?.구분 === "이월" ? { 원본행id: m.이월원본행id || m.id } : undefined;
  // 연결 미팅 id 기록 — 02↔04 매칭을 개명/계약일변경에도 안전한 id 키로(AK).
  // BBE-53: dateCompanyFallback=true — meetingId 매칭 실패(미팅 못 찾음)에서도 재시도가
  // 새 행을 또 append 하지 않도록 (계약일+업체명) 으로 기존 행을 먼저 찾는다.
  const result = await appendFromContract(
    spreadsheetId,
    { ...data, meetingId: m?.id },
    carryover,
    undefined,
    true,
  );
  // 06 업체정보 스냅샷 — 계약 고객 누적 (consultation-log §1-2).
  // R3-3 PR-2: 파일럿=06 DB 동기 정본({syncDb} 관통) → 자연키(계약ref) 멱등 upsert 라 안전 payload
  // (_cleared:false·커스텀:{} 기본 병합)로 재사용 자연키의 stale content 부활 차단. **단 warn 유지**:
  // 부모(appendFromContract)는 findFirstEmptyRow 로 새 행을 잡는 **비멱등 append** 라, 여기서 throw 하면
  // 사용자 재시도가 append 재실행 → 중복 계약행=매출 이중계상(#558 교훈). 06 스냅샷 실패는 계약을
  // 깨지 않고, 미러 미반영 시 read 가 시트 fallback(빈 DB 행) 으로 수렴하므로 loud 불요.
  try {
    await upsertCompanyInfoArchive(
      spreadsheetId,
      { 업체명: data.업체명, 계약일: data.계약일, 업체정보: m?.업체정보 },
      { syncDb },
    );
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
 * 멱등키 = `prior:<uuid>`(랜덤 — 매 호출 새로 발급, 그 자체로는 재시도를 못 알아본다).
 * 폼 전체(수임비·슬롯·서류)는 appendFromContract(C/D/E+AI/AJ) 후 updateUserFields(F~AH)로
 * 반영. §2.5 가드는 두 repo 함수가 각자 보유(append=빈 행, updateUserFields=사용자영역).
 *
 * BBE-53: append 전에 (계약일+업체명+수임비, 구분=이월+prior: 행으로 범위 한정) 로 기존 행을
 * 먼저 찾는다. 있으면 새 행을 만들지 않고 그 행을 갱신 — 저장 재시도(응답 유실 등)가 중복
 * 계약행을 만들지 않는다. 이 검사를 "이월+prior:" 로 좁힌 이유: 같은 (계약일,업체명,수임비)
 * 조합이 우연히 진짜 다른 정식 계약(비이월) 행과 겹쳐도 그건 건드리지 않기 위함 — appendFromContract
 * 의 meetingId 폴백과 달리, 여기선 원천적으로 meetingId 가 없어 더 좁은 범위로 안전을 확보한다.
 * (클라이언트가 보낸 요청 단위 idempotency key 를 쓰는 더 정확한 방식은 app/api 변경이 필요해
 * 이 계약의 lease 밖 — 후속 과제로 남긴다.)
 */
export async function addPriorContract(
  email: string,
  cp: ContractPayment,
): Promise<{ row: number }> {
  const { spreadsheetId } = await resolveCtx(email);
  const existingRow = await findPriorContractRetry(spreadsheetId, cp);
  // append 계열 = R2 미러 유지(dual-sync 제외). 근거(db-write-flip §6 R3-3): append 는 행번호를
  // 시트가 할당(findFirstEmptyRow)하고 매 호출 새 prior:uuid 를 부여해 멱등키가 없다. 직후 dual-sync
  // updateUserFields(실패 throw)를 걸면 사용자 재시도가 append 를 재실행 → 중복 계약행 = 매출 이중계상.
  // 기존 행 편집(patch/terminate/…)만 dual-sync — 생성 액션은 R2(async 미러, no-throw)로 안전 유지.
  const row =
    existingRow ??
    (
      await appendFromContract(
        spreadsheetId,
        { 계약일: cp.계약일, 업체명: cp.업체명, 수임비: cp.수임비 },
        { 원본행id: `prior:${randomUUID()}` }, // 직접 등록 → 이월 깃발(AI=이월) 강제
      )
    ).row;
  // 슬롯·서류·메모(F~AH) 반영 — 폼에서 입력했으면 함께 저장. 재시도로 찾은 기존 행이면
  // 최신 제출값으로 self-heal(덮어쓰기) — 사용자가 재시도 사이 F~AH 를 고쳤어도 최신값이 남는다.
  await updateUserFields(spreadsheetId, { ...cp, row });
  return { row };
}

/** BBE-53 재시도 판정 — (계약일,업체명,수임비) 일치 + "이전 계약 직접등록" 출처(구분=이월,
 * 이월원본행id가 prior: 로 시작)인 행만 후보. 아레나 이월(carryover)·정식 계약(비이월)은 제외 —
 * 우연히 같은 (계약일,업체명,수임비) 라도 다른 출처 행을 건드리지 않는다. */
async function findPriorContractRetry(
  spreadsheetId: string,
  cp: { 계약일: string; 업체명: string; 수임비: number },
): Promise<number | null> {
  const rows = await readAll(spreadsheetId);
  const name = cp.업체명.trim();
  const found = rows.find(
    (r) =>
      r.구분 === "이월" &&
      (r.이월원본행id ?? "").startsWith("prior:") &&
      r.계약일 === cp.계약일 &&
      r.업체명.trim() === name &&
      r.수임비 === cp.수임비,
  );
  return found?.row ?? null;
}
