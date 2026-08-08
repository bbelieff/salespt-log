/**
 * Layer: repo — gcal 이벤트ID 맵 Postgres 저장 (BBE-62, R7 Phase 2 #13).
 *
 * 시트 셀(04!AT · 05!O)의 사용자별 JSON 맵을 (spreadsheet_id, kind, item_id, email) 4-키 행으로
 * 편 것. `pg` 는 이 파일에서만 다룬다(tests/structural/layers.test.ts postgres-isolation 가드).
 *
 * **event_id 의 세 가지 값**(migrations/0003 헤더와 동일):
 *   · 실제 eventId — 구글 캘린더 이벤트
 *   · `"-"`(EXCLUDE_MARKER) — 사용자가 이 일정을 캘린더에서 뺀 상태
 *   · `""` — **tombstone(삭제됨)**. 행을 지우지 않는 이유: 전환기엔 시트 미러가 남아 있어
 *     행을 지우면 다음 읽기가 시트 값을 주워 **지운 이벤트가 되살아난다**.
 */
import { dbEnabled, getDbPool, ensureSchema } from "./client";

export type GcalEventKindDb = "meeting" | "todo";

/**
 * 한 일정 행의 사용자별 맵. **tombstone(event_id='')도 그대로 반환**한다 — 호출부가
 * "삭제됨"과 "DB 에 아예 없음(=시트 폴백 대상)"을 구분해야 하기 때문(gcal-event-ids.ts 가 강제).
 */
export async function readGcalMapFromDb(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemId: string,
): Promise<Record<string, string>> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select email, event_id from gcal_event_ids
     where spreadsheet_id = $1 and kind = $2 and item_id = $3`,
    [spreadsheetId, kind, itemId],
  );
  const out: Record<string, string> = {};
  for (const r of res.rows as { email: string; event_id: string }[]) {
    out[r.email] = r.event_id ?? "";
  }
  return out;
}

/** 여러 일정 행의 맵을 한 번에(배치 토글 상태용) — itemId → (email → eventId). */
export async function readGcalMapsFromDbBatch(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  if (itemIds.length === 0) return out;
  await ensureSchema();
  const res = await getDbPool().query(
    `select item_id, email, event_id from gcal_event_ids
     where spreadsheet_id = $1 and kind = $2 and item_id = any($3)`,
    [spreadsheetId, kind, itemIds],
  );
  for (const r of res.rows as { item_id: string; email: string; event_id: string }[]) {
    const bucket = out.get(r.item_id) ?? {};
    bucket[r.email] = r.event_id ?? "";
    out.set(r.item_id, bucket);
  }
  return out;
}

/**
 * 한 사용자 키 upsert. `eventId=""` 는 tombstone(삭제됨) 기록이다 — 삭제 의도를 표현할 때
 * DELETE 대신 이 함수를 쓴다(위 헤더의 되살아남 방지).
 *
 * ⚠️ **read-merge-write 가 아니다** — 사용자별로 행이 분리돼 있어 남의 키를 건드릴 수 없다.
 * 기존 시트 경로가 `withCellLock` 으로 막아야 했던 lost update 가 **구조적으로 불가능**해졌고,
 * 그 덕에 단일 pm2 인스턴스 전제도 사라진다(BBE-62 부수 효과).
 */
export async function upsertGcalEventId(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemId: string,
  email: string,
  eventId: string,
): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `insert into gcal_event_ids (spreadsheet_id, kind, item_id, email, event_id)
     values ($1, $2, $3, $4, $5)
     on conflict (spreadsheet_id, kind, item_id, email)
     do update set event_id = excluded.event_id, updated_at = now()`,
    [spreadsheetId, kind, itemId, email, eventId],
  );
}

/**
 * 시트 → DB 최초 이전(lazy backfill) — **없는 키만** 삽입(`do nothing`). 이미 DB 에 값이 있으면
 * 그 값이 정본이므로 옛 시트 값이 덮어쓰지 않는다. 읽기 경로에서 fire-and-forget 으로 호출.
 */
export async function backfillGcalMapIfAbsent(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemId: string,
  map: Record<string, string>,
): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  const entries = Object.entries(map);
  if (entries.length === 0) return;
  await ensureSchema();
  const client = await getDbPool().connect();
  try {
    await client.query("begin");
    for (const [email, eventId] of entries) {
      await client.query(
        `insert into gcal_event_ids (spreadsheet_id, kind, item_id, email, event_id)
         values ($1, $2, $3, $4, $5)
         on conflict (spreadsheet_id, kind, item_id, email) do nothing`,
        [spreadsheetId, kind, itemId, email, eventId],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 이 일정 행의 **모든 키를 tombstone 으로** 만든다(행 삭제 시). 기존 `clearGcalCell` 대응.
 * DELETE 가 아닌 이유는 위 헤더 참조(시트 폴백이 지운 값을 되살리는 것 방지).
 */
export async function tombstoneAllInDb(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemId: string,
): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `update gcal_event_ids set event_id = '', updated_at = now()
     where spreadsheet_id = $1 and kind = $2 and item_id = $3 and event_id <> ''`,
    [spreadsheetId, kind, itemId],
  );
}

/**
 * 제외 마커('-')만 남기고 실제 eventId 는 tombstone 처리 — 기존 `keepOnlyMarkers` 대응.
 * 되돌릴 수 있는 전이(미팅 취소·투두 숨김)에서 타 사용자의 개별 토글 제외를 보존한다.
 */
export async function keepOnlyMarkersInDb(
  spreadsheetId: string,
  kind: GcalEventKindDb,
  itemId: string,
  marker: string,
): Promise<void> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  await getDbPool().query(
    `update gcal_event_ids set event_id = '', updated_at = now()
     where spreadsheet_id = $1 and kind = $2 and item_id = $3
       and event_id <> '' and event_id <> $4`,
    [spreadsheetId, kind, itemId, marker],
  );
}
