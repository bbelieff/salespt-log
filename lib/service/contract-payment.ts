/**
 * Layer: service — 계약수납 유스케이스 (PR 11).
 *
 * 시트 02 계약수납관리:
 *   - 일정·계약 탭에서 계약 액션 시 row 자동 생성 (appendFromContract)
 *   - 계약수납탭에서 사용자가 F~AA 입력 → patch (updateUserFields)
 *   - 삭제 → clearRow
 */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { dbEnabled } from "@/repo/db/client";
import {
  readCompanyInfoFromDb,
  readContractsFromDb,
} from "@/repo/db/read-daily";
import { chooseDailySource, chooseWriteSource } from "./daily-source";
import { backfillMissingRows } from "./sheet-backfill";
import {
  clearRow,
  readAll,
  readContractCascadeKey,
  syncFeeFromContract,
  updateLinkFields,
  updateUserFields,
} from "@/repo/contract-payment";
import type { CompanyInfo, ContractPayment } from "@/types";
import {
  findMeetingsByDateRecord,
  patchMeetingRecord,
  type MeetingCtx,
} from "./meetings-write";
import {
  readCompanyInfoArchiveRow,
  renameCompanyInfoKey,
  upsertCompanyInfoArchive,
} from "@/repo/company-info-archive";
import { writeTermination } from "@/repo/contract-payment-termination";

/** R3-2: 04 미팅 프리미티브(meetings-write)에 게이트 판정 재료(cohort·email)를 넘기기 위해
 * spreadsheetId 단독 대신 ctx 반환 — 02 시트 경로 자체는 R3-3 소관으로 불변.
 * export: contract-payment-add.ts(addPriorContract) 재사용 — 새 검색/조회 로직 0. */
export async function resolveCtx(email: string): Promise<MeetingCtx> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contract-payment] 등록되지 않은 사용자: ${email}`);
  if (!user.spreadsheetId) throw new Error(`[no-sheet] 개인 시트가 없는 계정: ${email}`);
  return { spreadsheetId: user.spreadsheetId, cohort: user.cohort, email };
}

// isCarryoverContract(이월 판정 단일 결정점)은 클라이언트(실무수납 UI)도 써야 하므로
// @/types 로 이전(googleapis 비의존). 여기선 @/types 재노출만.
export { isCarryoverContract } from "@/types";

/** 모든 계약수납 row 조회.
 *
 * 파일럿: DB 단일 쿼리(정본) + 시트 전체 read 를 **병렬** 발사해, DB 에 없는(= append
 * 미러 실패로 누락된) 신규 계약행만 시트에서 보충한다(union, R3 §7-3 L4). row(시트 행번호)
 * 조인 + linkedMeetingId 2차 dedupe(수동 행이동 drift 중복 방지). R2-4 의 "시트 0회"
 * 속도이득은 반납하나 지연은 max(DB,시트)=시트 수준. DB read 실패 시 시트 전체 fallback
 * (화면 에러 금지). 비파일럿 불변. */
export async function loadContractPayments(
  email: string,
): Promise<ContractPayment[]> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contract-payment] 등록되지 않은 사용자: ${email}`);
  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    const [dbRes, sheetRes] = await Promise.allSettled([
      readContractsFromDb(user.spreadsheetId),
      readAll(user.spreadsheetId),
    ]);
    if (dbRes.status === "fulfilled") {
      return sheetRes.status === "fulfilled"
        ? backfillMissingRows(
            dbRes.value,
            sheetRes.value,
            (c) => c.row,
            (c) => c.linkedMeetingId || undefined,
          )
        : dbRes.value; // 시트 read 실패 → DB 정본만(기존보다 나쁘지 않음)
    }
    // DB read 실패 → 기존처럼 시트 전체 silent fallback
    Sentry.captureException(dbRes.reason, {
      tags: { where: "loadContractPayments-db-read" },
    });
    if (sheetRes.status === "fulfilled") return sheetRes.value;
    throw sheetRes.reason; // 둘 다 실패 → 시트 에러 전파(기존 readAll throw 와 동등)
  }
  return readAll(user.spreadsheetId);
}

/**
 * 계약 핵심필드(업체명·계약일·수임료) 편집 — 실무/수납에서. 연결 미팅 id 로 대상 특정(개명 안전).
 * 멀티시트 건별 try/catch 격리 → 실패한 시트명 배열 반환(반쪽 동기화 침묵 금지).
 *   · 업체명 → 02 D + 04 G + 06 스냅샷   · 계약일 → 02 C + 06 (04 미팅날짜 비접촉)   · 수임료 → 02 E + 04 L
 */
export async function editContractLinkedFields(
  email: string,
  input: {
    meetingId?: string;
    old: { 계약일: string; 업체명: string };
    next: { 계약일?: string; 업체명?: string; 수임비?: number };
  },
): Promise<{ failures: string[] }> {
  // R3-2+R3-3 병합: syncDb(02 편집 dual-sync)·ctx(04 미팅 프리미티브) 둘 다 필요.
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  const failures: string[] = [];
  const new계약일 = input.next.계약일 ?? input.old.계약일;
  const new업체명 = input.next.업체명 ?? input.old.업체명;
  const 업체명Changed = input.next.업체명 !== undefined && new업체명 !== input.old.업체명;
  const 계약일Changed = input.next.계약일 !== undefined && new계약일 !== input.old.계약일;
  const 수임료Changed = input.next.수임비 !== undefined;

  if (업체명Changed || 계약일Changed) {
    try {
      await updateLinkFields(
        spreadsheetId,
        { ...input.old, meetingId: input.meetingId },
        { 계약일: new계약일, 업체명: new업체명 },
        { syncDb },
      );
    } catch {
      failures.push("02 계약수납(업체명·계약일)");
    }
  }
  if (수임료Changed) {
    try {
      await syncFeeFromContract(
        spreadsheetId,
        {
          meetingId: input.meetingId,
          계약일: new계약일,
          업체명: new업체명,
          수임비: input.next.수임비!,
        },
        { syncDb },
      );
    } catch {
      failures.push("02 계약수납(수임료)");
    }
  }
  // 04 미팅: 업체명 G·수임비 L 만. 미팅날짜 D 비접촉(계약일은 04 미반영 — 통계 안전).
  if ((업체명Changed || 수임료Changed) && input.meetingId) {
    try {
      const partial: { 업체명?: string; 수임비?: number } = {};
      if (업체명Changed) partial.업체명 = new업체명;
      if (수임료Changed) partial.수임비 = input.next.수임비;
      await patchMeetingRecord(ctx, input.meetingId, partial);
    } catch {
      failures.push("04 업체관리(미팅)");
    }
  }
  if (업체명Changed || 계약일Changed) {
    try {
      await renameCompanyInfoKey(
        spreadsheetId,
        input.old,
        { 계약일: new계약일, 업체명: new업체명 },
        { syncDb }, // R3-3 PR-2: 파일럿=06 DB 동기 정본
      );
    } catch {
      failures.push("06 업체정보");
    }
  }
  return { failures };
}

// addFromContract(미팅에서 계약)·addPriorContract(이전 계약 직접등록) — 500줄 캡으로 분리(R3-3 선례).
export { addFromContract, addPriorContract } from "./contract-payment-add";

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
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contract-payment] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;
  // R2-4b: 파일럿은 06 미러 DB 조회 먼저. 실질 값이 있으면 그대로(시트 read 0회),
  // 빈 결과(rename 새 키 = 스냅샷 미보유 부류)·실패는 기존 시트 경로로 자연 fallback.
  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    try {
      const fromDb = await readCompanyInfoFromDb(spreadsheetId, data.계약일, data.업체명);
      if (hasCompanyInfo(fromDb)) return fromDb;
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadCompanyInfo-db-read" } });
    }
  }
  const archived = await readCompanyInfoArchiveRow(spreadsheetId, data.계약일, data.업체명);
  if (hasCompanyInfo(archived)) return archived;
  try {
    const meetings = await findMeetingsByDateRecord(
      { spreadsheetId, cohort: user.cohort, email },
      data.계약일,
      "meeting",
    );
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
  // R3-2+R3-3 병합: ctx(04 미팅 프리미티브) + syncDb(06 dual-sync) 둘 다 필요.
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  let meetingUpdated = false;
  const meetings = await findMeetingsByDateRecord(ctx, data.계약일, "meeting");
  const m = meetings.find((x) => x.업체명.trim() === data.업체명.trim());
  if (m) {
    await patchMeetingRecord(ctx, m.id, { 업체정보: data.업체정보 });
    meetingUpdated = true;
  }
  // R3-3 PR-2: 사용자 직접 저장 → 파일럿은 06 DB 동기 정본(실패=throw, read-your-writes).
  await upsertCompanyInfoArchive(spreadsheetId, data, { syncDb });
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
  const { spreadsheetId, syncDb } = await resolveSheetWithSyncDb(email);
  return syncFeeFromContract(spreadsheetId, data, { syncDb });
}

/** 사용자 입력 영역(F~AA) patch. */
export async function patchContractPayment(
  email: string,
  cp: ContractPayment,
): Promise<void> {
  const { spreadsheetId, syncDb } = await resolveSheetWithSyncDb(email);
  await updateUserFields(spreadsheetId, cp, { syncDb });
}

/**
 * 계약해지 (contract-termination) — 사유 필수·반환액 ≥0, 보존/숨김(soft delete) 선택.
 * 해지일 = 오늘(KST). 매출 반영(수임비+수납−반환액)은 읽기 시점 계산(dashboard·payment 화면).
 */
export async function terminateContract(
  email: string,
  input: { row: number; 사유: string; 반환액: number; 숨김: boolean },
): Promise<void> {
  if (!input.사유.trim()) {
    throw new Error("해지 사유를 입력해 주세요");
  }
  if (!Number.isFinite(input.반환액) || input.반환액 < 0) {
    throw new Error("반환액은 0 이상의 숫자여야 해요");
  }
  const { spreadsheetId, syncDb } = await resolveSheetWithSyncDb(email);
  const 해지일 = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10); // KST
  await writeTermination(
    spreadsheetId,
    input.row,
    {
      해지일,
      해지사유: input.사유.trim(),
      반환액: input.반환액,
      해지숨김: input.숨김,
    },
    { syncDb },
  );
}

/** 이 사용자의 쓰기가 DB 동기 반영 대상인지 — 화면이 DB read(파일럿)면 true (Dev3-A 작업1).
 * export: contract-payment-add.ts(addFromContract) 재사용.
 *
 * BBE-246: 읽기 게이트(chooseDailySource)가 아니라 **쓰기 게이트**(chooseWriteSource)를 쓴다 —
 * db.ts::resolveWriteCtx·sales-write.ts::isDbCanonical·meetings-write.ts::isDb 전부 write 게이트를
 * 쓰는데 이 함수만 read 게이트 이름을 빌려 쓰고 있었다(현재는 두 게이트가 byte-identical 이라
 * 동작 차이는 없었지만, 읽기·쓰기 파일럿 집합이 갈리는 순간 이 함수만 조용히 잘못된 게이트를
 * 추적하게 된다 — BBE-246 조사에서 발견, 이번에 정정). */
export async function resolveSheetWithSyncDb(
  email: string,
): Promise<{ spreadsheetId: string; syncDb: boolean; ctx: MeetingCtx }> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contract-payment] 등록되지 않은 사용자: ${email}`);
  return {
    spreadsheetId: user.spreadsheetId,
    syncDb: chooseWriteSource(user.cohort, dbEnabled()) === "db",
    ctx: { spreadsheetId: user.spreadsheetId, cohort: user.cohort, email },
  };
}

/** row 통째로 clear. 파일럿은 시트+DB 동시(실패 시 에러 — 조용한 반쪽 삭제 금지). */
export async function removeContractPayment(
  email: string,
  row: number,
): Promise<void> {
  const { spreadsheetId, syncDb } = await resolveSheetWithSyncDb(email);
  await clearRow(spreadsheetId, row, { syncDb });
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
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);

  // 1) 삭제 전 row 의 (계약일, 업체명) 읽기 — cascade key.
  // resolveLayout 경유로 6기 `02 계약관리` 탭 alias 자동 처리 (bugfix 2026-06).
  const { 계약일, 업체명 } = await readContractCascadeKey(spreadsheetId, row);

  // 2) clearRow — 파일럿은 시트+DB 동시(조용한 반쪽 삭제 금지)
  await clearRow(spreadsheetId, row, { syncDb });

  // 3) 매칭 미팅 찾기 (R3-2: 파일럿=DB — 읽기 동반 전환)
  if (!계약일 || !업체명) {
    return {
      cascade: "row 의 계약일/업체명 비어있어 cascade 생략",
      meetingId: null,
      미팅날짜: null,
    };
  }
  const meetings = await findMeetingsByDateRecord(ctx, 계약일, "meeting");
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

  // 4) 미팅 revert (gcal reconcile 포함 — 경로별 내부 처리)
  await patchMeetingRecord(ctx, target.id, {
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
