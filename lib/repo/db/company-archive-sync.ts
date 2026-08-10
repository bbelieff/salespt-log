/**
 * Layer: repo — 06 업체정보(company_archive) 행의 DB **동기** 반영 (R3-3 PR-2, db-write-flip §6).
 *
 * #544(contracts, db/contracts-clear.ts)의 dual-sync 골격을 company_archive 로 이식.
 * 차이 = row_key 가 시트 행번호(r{row})가 아니라 **자연키(계약ref, C열)**. 자연키라 upsert 가
 * 시트에서 append 를 유발해도 DB 는 `on conflict (spreadsheet_id, tab, row_key)` 병합 →
 * 재시도가 중복행을 만들지 않는다(contracts append 가 dual-sync 제외였던 이유가 여기선 무효 —
 * #544 가 "company_archive(자연키)는 PR-2로 분리"한 근거).
 *
 * 파일럿(화면=DB read, R2-4b loadCompanyInfoByContract)에서 쓰기 미러가 한 번 실패하면 DB 엔
 * 옛 값이 잔존(시트 fallback 은 느린 안전망)·드리프트 누적. 편집·개명을 시트+DB 한 동작으로:
 * DB 반영 실패 시 사용자 에러(재시도 유도, 시트폴백 금지 §0). 비파일럿은 R2 미러(async) 유지.
 */
import { CompanyInfo } from "@/types";
import { findOwnerBySpreadsheetId } from "../users";
import { dbEnabled, ensureSchema, getDbPool, upsertSheetRow } from "./client";
import { mirrorClearRow, mirrorSheetRow } from "./mirror";

const TAB = "company_archive" as const;

/** R3-3 PR-2 dual-write 옵션 — 파일럿이면 DB 동기 정본(실패=throw), 아니면 R2 미러(async). */
export type CompanyArchiveWriteOpts = { syncDb?: boolean };

const SYNC_FAIL =
  "저장이 화면 데이터에 아직 반영되지 않았어요. 잠시 후 다시 시도해 주세요.";

/** 계약ref 병합 upsert 를 await + 1회 재시도. 최종 실패 = throw. owner 역조회 실패는 "?"/"". */
async function upsertArchiveRowWithRetry(
  spreadsheetId: string,
  rowKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!dbEnabled()) return; // DB 미설정 환경(로컬 등) — no-op
  const owner = await findOwnerBySpreadsheetId(spreadsheetId).catch(() => null);
  const doUpsert = () =>
    upsertSheetRow({
      cohort: owner?.cohort ?? "?",
      email: owner?.email ?? "",
      spreadsheetId,
      tab: TAB,
      rowKey,
      payload,
    });
  try {
    await doUpsert();
  } catch {
    try {
      await doUpsert(); // 병합이라 멱등 — 1회 재시도
    } catch {
      throw new Error(SYNC_FAIL);
    }
  }
}

/**
 * 06 upsert 정본 라우팅 — 파일럿=계약ref 병합 upsert 동기(실패=throw), 비파일럿=R2 미러(async).
 * payload 키는 dual-write 미러와 동일(= DB read 재구성 규칙과 정합).
 */
export async function persistCompanyArchiveRow(
  spreadsheetId: string,
  rowKey: string,
  payload: Record<string, unknown>,
  opts?: CompanyArchiveWriteOpts,
): Promise<void> {
  if (opts?.syncDb) {
    // upsert = 행 활성화(시트는 A:AB 전체행 replace). jsonb 병합(payload || excluded)상 payload 에
    // 없는 키는 생존하므로 두 기본값을 명시해 시트 전체행 쓰기와 의미를 맞춘다:
    //  · _cleared:false — rename 이 남긴 _cleared:true 를 부활(없으면 재사용 자연키가 DB 에서 영구 숨김).
    //  · 커스텀:{} — CompanyInfo 스칼라는 default("") 라 항상 덮이지만 커스텀만 optional(키 부재) →
    //    부활 시 이전 생(生)의 stale 커스텀이 딸려 올라옴(결제카드에 남의 커스텀 노출). 빈 기본값으로 차단.
    // payload 가 해당 키를 가지면 스프레드가 뒤에 오므로 사용자 값이 이긴다.
    await upsertArchiveRowWithRetry(spreadsheetId, rowKey, {
      _cleared: false,
      커스텀: {},
      ...payload,
    });
  } else {
    mirrorSheetRow({ spreadsheetId, tab: TAB, rowKey, payload });
  }
}

/**
 * rename 새 키 payload 정규화 — **content 를 명시적으로 비운다.**
 *
 * 설계 불변식: rename 은 06 의 키(A~D)만 옮기고 **E~AB 스냅샷은 시트가 보존**한다 → DB 의 새 키 행은
 * "키필드만" 이어야 하고, 업체정보 read 는 `hasCompanyInfo(fromDb)=false` 로 **시트 fallback** 을 타야 한다.
 *
 * 그런데 jsonb 는 **얕은 병합**(payload || excluded)이라 키필드만 보내면 **그 자연키에 남아 있던 옛 행의
 * content 가 그대로 살아 돌아온다**(A→B 개명 → B 에서 정보수정 → B→A 되돌림 ⇒ A 가 **옛 v1** 스칼라·커스텀째 부활).
 * 그러면 `hasCompanyInfo` 가 true 라 시트 fallback 이 **영영 발동하지 않고** 결제카드가 옛 값을 보여준다
 * (무에러·200 = 조용한 반쪽쓰기). #559 가 upsert 경로만 정규화하고 이 경로를 우회한 것이 근인(DevD 재플래그).
 *
 * → `CompanyInfo.parse({})`(모든 스칼라 default "") + `커스텀:{}` 을 실어 **옛 content 를 확실히 덮는다.**
 * 그래야 "키필드만" 이라는 불변식이 DB 에서도 실제로 참이 되고, 시트 fallback 이 정본으로 동작한다.
 */
function renameKeyOnlyPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return { ...CompanyInfo.parse({}), 커스텀: {}, ...payload };
}

/**
 * rowKey(계약ref) 의 최신 DB payload 원본 — R7-#11(BBE-60) 시트 수렴잡 전용
 * (company-info-archive.ts:queueCompanyArchiveSheetSync). `_cleared` 포함 그대로 반환
 * (필터링은 호출부 소관). 행 없으면 null. read-daily.ts 를 안 쓰는 이유 = 순환참조 회피
 * (read-daily.ts 가 이미 company-info-archive.ts 의 companyContractRef 를 import).
 */
export async function readCompanyArchiveRowPayload(
  spreadsheetId: string,
  rowKey: string,
): Promise<Record<string, unknown> | null> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload from sheet_rows
     where spreadsheet_id = $1 and tab = $2 and row_key = $3`,
    [spreadsheetId, TAB, rowKey],
  );
  return (
    (res.rows[0] as { payload: Record<string, unknown> } | undefined)?.payload ?? null
  );
}

/**
 * 06 개명(키 이동) 정본 라우팅 — old 키 _cleared 후 new 키 **키필드만**(content 비움) 병합.
 * 파일럿=둘 다 동기(실패=throw), 비파일럿=R2 미러(async). E~AB 스냅샷은 시트가 보존(양 경로 공통).
 *
 * 순서 = clear old → set new (역순 금지): set-new 성공 후 clear-old 실패 시 old/new 중복행이
 * 남아 stale 읽기 위험. clear-old 우선이면 최악이 "new 키 DB 부재"뿐이고 시트 fallback 이 흡수.
 */
export async function persistCompanyArchiveRename(
  spreadsheetId: string,
  oldKey: string,
  next: { rowKey: string; payload: Record<string, unknown> },
  opts?: CompanyArchiveWriteOpts,
): Promise<void> {
  // 양 경로 공통 정규화 — 비파일럿 DB 는 정본으로 안 읽히지만, 드리프트를 남기지 않아야
  // R3 로 그 기수가 파일럿이 되는 순간 stale 부활이 되살아나지 않는다.
  const payload = renameKeyOnlyPayload(next.payload);
  if (opts?.syncDb) {
    await upsertArchiveRowWithRetry(spreadsheetId, oldKey, { _cleared: true });
    await upsertArchiveRowWithRetry(spreadsheetId, next.rowKey, payload);
  } else {
    mirrorClearRow({ spreadsheetId, tab: TAB, rowKey: oldKey });
    mirrorSheetRow({ spreadsheetId, tab: TAB, rowKey: next.rowKey, payload });
  }
}
