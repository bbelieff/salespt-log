/**
 * Layer: repo — 02 계약 행의 DB **동기** 반영 (조용한 반쪽 쓰기 금지).
 *
 * 배경: 실무/수납 화면이 DB read(R2-4)인 파일럿에서, 쓰기의 DB 미러(fire-and-forget,
 * 무재시도)가 한 번이라도 실패하면 시트만 바뀌고 화면(DB)엔 옛 값이 영구 잔존한다.
 * 삭제(Dev3-A 작업1) + R3-3 편집(수납·수임비·해지·링크)은 시트+DB 를 한 동작으로:
 * DB 반영 실패 시 사용자에게 에러(재시도 유도). 대상 op 는 **기존 행(r{row}) 멱등** 병합
 * upsert 라 재시도가 중복행을 만들지 않는다(append 는 행번호 할당이 시트-first 라 제외 —
 * db-write-flip §6 R3-3). 비파일럿(시트 read)은 기존 fire-and-forget 미러 유지(호출부 게이트).
 */
import type { ContractPayment } from "@/types";
import { findOwnerBySpreadsheetId } from "../users";
import { dbEnabled, ensureSchema, getDbPool, upsertSheetRow } from "./client";
import { mirrorSheetRow } from "./mirror";

/** R3-3 dual-write 옵션 — 파일럿(화면=DB read)이면 DB 동기 정본(실패=throw), 아니면 R2 미러(async). */
export type ContractWriteOpts = { syncDb?: boolean };

/** r{row} 병합 upsert 를 await + 1회 재시도. 최종 실패 = throw(failMsg). owner 역조회 실패는 "?"/"". */
async function upsertContractRowWithRetry(
  spreadsheetId: string,
  row: number,
  payload: Record<string, unknown>,
  failMsg: string,
): Promise<void> {
  if (!dbEnabled()) return; // DB 미설정 환경(로컬 등) — no-op
  const owner = await findOwnerBySpreadsheetId(spreadsheetId).catch(() => null);
  const doUpsert = () =>
    upsertSheetRow({
      cohort: owner?.cohort ?? "?",
      email: owner?.email ?? "",
      spreadsheetId,
      tab: "contracts",
      rowKey: `r${row}`,
      payload,
    });
  try {
    await doUpsert();
  } catch {
    try {
      await doUpsert(); // 병합이라 멱등 — 1회 재시도
    } catch {
      throw new Error(failMsg);
    }
  }
}

/** _cleared 마킹을 await + 1회 재시도. 최종 실패 = throw(사용자 에러). */
export async function clearContractRowInDbSync(
  spreadsheetId: string,
  row: number,
): Promise<void> {
  await upsertContractRowWithRetry(
    spreadsheetId,
    row,
    { _cleared: true },
    "삭제가 화면 데이터에 아직 반영되지 않았어요. 잠시 후 한 번 더 삭제해 주세요.",
  );
}

/** R3-3 편집 정본 — r{row} 에 부분/전체 payload 를 jsonb 병합 upsert(정본). 실패=throw(시트폴백 금지).
 * payload 키는 dual-write 미러와 동일(= DB read 재구성 규칙과 정합). */
export async function upsertContractRowToDbSync(
  spreadsheetId: string,
  row: number,
  payload: Record<string, unknown>,
): Promise<void> {
  await upsertContractRowWithRetry(
    spreadsheetId,
    row,
    payload,
    "저장이 화면 데이터에 아직 반영되지 않았어요. 잠시 후 다시 시도해 주세요.",
  );
}

/** 02 계약 행 편집의 DB-side 반영 라우팅(R3-3) — 파일럿=동기 정본(실패=throw), 비파일럿=R2 미러(async).
 * payload 키는 양쪽 동일. append 는 제외(행번호=시트 할당 → 재시도 중복행 위험, db-write-flip §6 R3-3). */
export async function persistContractRow(
  spreadsheetId: string,
  row: number,
  payload: Record<string, unknown>,
  opts?: ContractWriteOpts,
): Promise<void> {
  if (opts?.syncDb) {
    await upsertContractRowToDbSync(spreadsheetId, row, payload);
  } else {
    mirrorSheetRow({ spreadsheetId, tab: "contracts", rowKey: `r${row}`, payload });
  }
}

/**
 * `updateUserFields` 가 **실제로 시트에 쓰는 범위(F:AH = 사용자 편집영역)** 의 필드만.
 *
 * 화이트리스트인 이유(denylist 아님 — #558 PARTIAL ③, DevD): updateUserFields 는 F:AH 만 쓰므로
 * 그 밖의 필드를 DB 미러에 실으면 **시트엔 없는 값이 DB 에만 생긴다**. arena-carryover 는 **이전
 * 기수의 옛 계약(외래 소스)** 을 그대로 넘기므로 특히 위험:
 *   · `구분`/`이월원본행id`(AI·AJ) → 갓 찍은 이월 flag 를 ''로 **클로버**(#558 1차 수리)
 *   · `해지일·해지사유·반환액·해지숨김`(AL~AO) → **해지된 옛 계약을 이월하면 DB 만 해지**(반환액 차감·
 *     해지 뱃지) / 시트는 미해지 → DB↔시트 갈림
 *   · `linkedMeetingId`(AK) → 옛 기수 미팅 id 가 새 행에 누출
 * 화이트리스트라 **앞으로 AP 이후에 필드가 늘어도 자동으로 누출되지 않는다**(denylist 였다면 누출).
 * C/D/E(계약일·업체명·수임비)도 F:AH 밖 — `appendFromContract`·`updateLinkFields`·`syncFeeFromContract`
 * 가 정본이다. 이월 마킹은 `appendFromContract` + arena-carryover 의 durable 재확정이 담당.
 */
const USER_AREA_KEYS = [
  // F~L 체크박스 7
  "공동인증서",
  "임대차계약서",
  "신분증",
  "드라이브업로드",
  "사업계획서초안발송",
  "컨설팅5종서류발송",
  "플러그이관",
  // M~AD 슬롯 3 (+ AF/AG/AH 슬롯메모는 각 슬롯 객체의 .메모)
  "수납1",
  "수납2",
  "수납3",
  // AE 로드맵메모
  "로드맵메모",
] as const;

export function userFieldsMirrorPayload(
  cp: ContractPayment,
): Record<string, unknown> {
  const src = cp as unknown as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const k of USER_AREA_KEYS) {
    if (src[k] !== undefined) payload[k] = src[k];
  }
  return payload;
}

/**
 * r{row} 의 최신 DB payload 원본 — BBE-246 시트 수렴잡 전용(contract-sheet-sync.ts).
 * `_cleared` 포함 그대로 반환(필터링은 호출부 소관). 행 없으면 null.
 * (company-info-archive.ts:readCompanyArchiveRowPayload 와 동일 패턴 — R7-#11 BBE-60 선례.)
 */
export async function readContractRowPayload(
  spreadsheetId: string,
  row: number,
): Promise<Record<string, unknown> | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2`,
    [spreadsheetId, `r${row}`],
  );
  return (
    (res.rows[0] as { payload: Record<string, unknown> } | undefined)?.payload ?? null
  );
}
