/**
 * repo/db/todo-trash — 지운 ToDo(휴지통). 삭제는 {_cleared:true} jsonb 병합이라 내용이 그대로 남는다.
 * 지운 시각 = 행의 updated_at(지운 뒤 고칠 수 없으니 마지막 변경 = 삭제). 2026-10-28 앱 휴지통.
 */
import type { Todo } from "@/types";
import { dbEnabled, ensureSchema, getDbPool } from "./client";
import { todoFromDbPayload } from "./read-daily";

/** 휴지통에 보여 줄 최대 건수(최근 지운 순). */
export const TODO_TRASH_LIMIT = 300;

export async function readDeletedTodosFromDb(spreadsheetId: string): Promise<{ todo: Todo; deletedAt: string }[]> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select payload, updated_at from sheet_rows
     where spreadsheet_id = $1 and tab = 'todos'
       and coalesce((payload->>'_cleared')::boolean, false) = true
     order by updated_at desc limit $2`,
    [spreadsheetId, TODO_TRASH_LIMIT],
  );
  const out: { todo: Todo; deletedAt: string }[] = [];
  for (const { payload, updated_at } of res.rows as { payload: Record<string, unknown>; updated_at: Date | string }[]) {
    const todo = todoFromDbPayload(payload);
    // 내용이 없는 옛 삭제 행(제목 없음)은 되살려도 빈 할 일이라 보여 주지 않는다.
    if (todo && todo.제목.trim()) out.push({ todo, deletedAt: new Date(updated_at).toISOString() });
  }
  return out;
}
