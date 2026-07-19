/**
 * Layer: repo — 시트 미러 재시도 표식 (mirror_pending, db-write-flip §2.2·§3·§7-3).
 *
 * R3 쓰기전환(DB 정본 → 시트 **비동기** 미러) 경로에서, DB 쓰기는 성공했는데 시트 미러가
 * 지수/선형 백오프 재시도 끝에 실패한 경우 → 그 행을 mirror_pending 으로 마킹한다.
 * 응답은 이미 성공(정본=DB) 이므로 이건 **순수 사후 안전망**. 다음 수렴 동기화(queueSheetSync)가
 * pending 행을 재드라이브해 시트를 self-heal → 시트=DB 정합이 사람 개입 없이 흡수된다(§4).
 *
 * 표식은 sheet_rows.mirror_pending **컬럼**(client.ts 스키마) — 정본 payload 를 오염시키지 않고
 * jsonb 얕은 병합 부작용도 없다. 마킹/해제는 UPDATE(행은 이미 DB 쓰기로 존재).
 *  • DATABASE_URL 미설정 = 전면 no-op(비파일럿·로컬·CI 불변).
 *  • 실패해도 삼킨다(안전망 자신이 앱을 막으면 안 됨) — 호출부가 .catch 로 감싼다.
 *
 * ⚠️ 안전 기본값(2026-07-19): "최종 실패 시 마킹"(계획서 §2.2 원문). DB 쓰기 성공 직후
 * 프로세스가 죽어 동기화 잡이 아예 안 돈 crash-window 는 이 방식이 못 잡는다 — 더 견고한
 * 대안(updated_at 대비 mirror_synced_at 타임스탬프)은 belie 결정 대기(worklog 📥). 되돌리기 = 코드 revert.
 */
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import type { MirrorTab } from "./mirror";

export interface MirrorPendingRef {
  spreadsheetId: string;
  tab: MirrorTab;
  rowKey: string;
}

/** 시트 미러 최종 실패 → 행을 pending 으로 마킹. 행이 없으면 no-op(0 rows).
 * updated_at 도 갱신 — drain 은 `order by updated_at asc limit 25` 라, 재마킹 시 시각을 올려
 * 실패행을 큐 뒤로 회전시켜야 뒤에 쌓인 정상 pending 행이 굶지 않는다(starvation 방지). */
export async function markMirrorPending(p: MirrorPendingRef): Promise<void> {
  if (!dbEnabled()) return;
  await ensureSchema();
  await getDbPool().query(
    `update sheet_rows set mirror_pending = true, updated_at = now()
       where spreadsheet_id = $1 and tab = $2 and row_key = $3`,
    [p.spreadsheetId, p.tab, p.rowKey],
  );
}

/** 시트 미러 성공 → pending 해제. 이미 false 면 0 rows(부분 인덱스로 저렴). */
export async function clearMirrorPending(p: MirrorPendingRef): Promise<void> {
  if (!dbEnabled()) return;
  await ensureSchema();
  await getDbPool().query(
    `update sheet_rows set mirror_pending = false
       where spreadsheet_id = $1 and tab = $2 and row_key = $3 and mirror_pending`,
    [p.spreadsheetId, p.tab, p.rowKey],
  );
}

/** 한 시트·탭의 pending row_key 목록(오래된 것부터) — drain 용. limit 로 1회 작업량 상한. */
export async function listMirrorPending(
  spreadsheetId: string,
  tab: MirrorTab,
  limit = 25,
): Promise<string[]> {
  if (!dbEnabled()) return [];
  await ensureSchema();
  const res = await getDbPool().query(
    `select row_key from sheet_rows
       where spreadsheet_id = $1 and tab = $2 and mirror_pending
       order by updated_at asc
       limit $3`,
    [spreadsheetId, tab, limit],
  );
  return (res.rows as { row_key: string }[]).map((r) => r.row_key);
}

/** 전체 pending 잔량 — admin 진단·드리프트 감시(§3). 미설정이면 null. */
export async function countMirrorPending(): Promise<number | null> {
  if (!dbEnabled()) return null;
  await ensureSchema();
  const res = await getDbPool().query(
    `select count(*)::int as n from sheet_rows where mirror_pending`,
  );
  return (res.rows[0]?.n as number) ?? 0;
}
