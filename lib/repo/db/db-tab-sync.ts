/**
 * Layer: repo — 03 DB관리 행의 DB **동기** 반영 (R3-4 dual-sync). contracts-clear.ts 의 db-tab 판.
 *
 * 배경: 03 화면이 DB read(R2-5)인 파일럿에서, 편집/삭제의 DB 미러(fire-and-forget·무재시도)가
 * 한 번이라도 실패하면 시트만 바뀌고 화면(DB)엔 옛 값이 영구 잔존한다. update/clear(기존 행
 * {섹션}:r{row} 멱등)를 시트+DB 한 동작으로: DB 반영 실패 시 사용자 에러(재시도 유도).
 *
 * 제외(설계): ①append — 행번호=시트 할당이라 재시도 시 중복행(이중계상), R2 async 유지
 * (db-write-flip §6 R3-4). BBE-59(R7-#10) Phase 1 이 append 를 UUID 키(db/row-key.ts)로 바꿔
 * "재시도 시 중복행" 전제를 없앴지만, append 를 실제 dual-sync 로 미는 건 Phase 3(별도 카드) —
 * 이 파일은 아직 update/clear 만 다룬다. ②생산 E(1일 유입 셀) — 컨택 저장이 직접 소유하는 값이라
 * 이 파일 스코프 밖(§6 71-73 유지, R3-4b 무관). 생산개수 M(writeProductionCountCell)은
 * **이 파일과 다른 non-throw 안전모드**로 BBE-61 에서 편입됨(db-production-cell.ts 참고) — throw
 * 하면 안 되는 이유(컨택 저장 경유, 이미 성공한 동작을 되돌리면 안 됨)가 여기(throw-on-fail)와
 * 상충해서 이 파일의 persistDbRow/clearDbRow 는 안 쓴다. 백필 컬럼폼 shadowing 은 read-db-tab.ts
 * 의 overlay 우선순위 수정(필드명이 항상 이김)으로 일반 해소됨(db-tab-form-overlay.test.ts).
 * 비파일럿(시트 read)은 기존 async 미러 유지(호출부 게이트).
 */
import { findOwnerBySpreadsheetId } from "../users";
import { dbEnabled, ensureSchema, getDbPool, upsertSheetRow } from "./client";
import { mirrorSheetRow, mirrorClearRow } from "./mirror";

/** R3-4 dual-write 옵션 — 파일럿(화면=DB read)이면 DB 동기 정본(실패=throw), 아니면 R2 미러(async). */
export type DbTabWriteOpts = { syncDb?: boolean };

/** {섹션}:r{row} 병합 upsert 를 await + 1회 재시도. 최종 실패 = throw(failMsg). owner 역조회 실패는 "?"/"". */
async function upsertDbRowWithRetry(
  spreadsheetId: string,
  rowKey: string,
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
      tab: "db",
      rowKey,
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

/** 03 행 편집 DB-side 반영 라우팅 — 파일럿=동기 정본(실패=throw·시트폴백 금지), 비파일럿=R2 미러(async).
 * payload 키는 async 미러와 동일(= DB read 재구성 규칙 정합). 호출부가 _cleared:false 를 포함해
 * 삭제 후 같은 행 재추가 시 부활시킨다(read-db-tab 의 _cleared 필터 대응). */
export async function persistDbRow(
  spreadsheetId: string,
  rowKey: string,
  payload: Record<string, unknown>,
  opts?: DbTabWriteOpts,
): Promise<void> {
  if (opts?.syncDb) {
    await upsertDbRowWithRetry(
      spreadsheetId,
      rowKey,
      payload,
      "저장이 화면 데이터에 아직 반영되지 않았어요. 잠시 후 다시 시도해 주세요.",
    );
  } else {
    mirrorSheetRow({ spreadsheetId, tab: "db", rowKey, payload });
  }
}

/** 03 행 삭제 DB-side 반영 — 파일럿=동기 _cleared 정본(실패=throw), 비파일럿=R2 미러(async).
 * extra: clear 시 함께 무효화할 필드(콜지기소 발굴id — lead-chain §4-3 B3). append 의 DB 쓰기만
 * fire-and-forget 이라 미러 유실 시 죽은 발굴id 가 잔존하고, 다음 append(재사용 행)가 _cleared:false 로
 * 되살리면 **새 lead 가 죽은 신원을 상속**한다. clear 가 발굴id:"" 를 명시 무효화하면 최악이 dangling(안전 실패). */
export async function clearDbRow(
  spreadsheetId: string,
  rowKey: string,
  opts?: DbTabWriteOpts,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (opts?.syncDb) {
    await upsertDbRowWithRetry(
      spreadsheetId,
      rowKey,
      { _cleared: true, ...extra },
      "삭제가 화면 데이터에 아직 반영되지 않았어요. 잠시 후 한 번 더 삭제해 주세요.",
    );
  } else if (extra && Object.keys(extra).length) {
    // mirrorClearRow 는 {_cleared:true} 고정이라 extra 를 못 싣는다 → 병합 미러로 함께 무효화.
    mirrorSheetRow({ spreadsheetId, tab: "db", rowKey, payload: { _cleared: true, ...extra } });
  } else {
    mirrorClearRow({ spreadsheetId, tab: "db", rowKey });
  }
}

/**
 * rowKey 의 최신 DB payload 원본 — BBE-246 시트 수렴잡 전용(../db-tab-sheet-sync.ts).
 * `_cleared` 포함 그대로 반환(필터링은 호출부 소관). 행 없으면 null.
 * (contracts-clear.ts:readContractRowPayload·company-archive-sync.ts:readCompanyArchiveRowPayload
 * 와 동일 패턴 — R7-#11 BBE-60 선례.)
 */
export async function readDbRowPayload(
  spreadsheetId: string,
  rowKey: string,
): Promise<Record<string, unknown> | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'db' and row_key = $2`,
    [spreadsheetId, rowKey],
  );
  return (
    (res.rows[0] as { payload: Record<string, unknown> } | undefined)?.payload ?? null
  );
}
