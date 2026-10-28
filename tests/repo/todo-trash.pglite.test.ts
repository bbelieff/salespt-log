/** 앱 휴지통(2026-10-28) — 지운 할 일이 내용째 남아 목록에 뜨고, 다른 사람 것은 안 보인다. 합성 데이터만. */
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ db: null as PGlite | null }));
async function query(sql: string, params: unknown[] = []) { const r = await fixture.db!.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, ensureSchema: async () => {}, getDbPool: () => ({ query }) }));
import { readDeletedTodosFromDb } from "@/repo/db/todo-trash";

const todo = (id: string, 제목: string) => ({ id, contractRef: "c1", institutionRef: "합성재단", 업체명: "합성상사", type: "기타", 제목, 예정일자: "2026-11-02", 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false, 생성시각: "", 분류: "", 기록종류: "todo", slot: 1, result: "", prevId: "" });
const put = (id: string, payload: unknown, sheet = "fixture-a", at = "2026-10-28T10:00:00Z") => query("insert into sheet_rows(spreadsheet_id,tab,row_key,payload,updated_at) values($1,'todos',$2,$3::jsonb,$4::timestamptz)", [sheet, id, JSON.stringify(payload), at]);
/** 실제 삭제와 같은 병합: payload || {_cleared:true}. */
const clear = (id: string, at: string) => query("update sheet_rows set payload = payload || '{\"_cleared\":true}'::jsonb, updated_at=$2::timestamptz where row_key=$1", [id, at]);

beforeAll(async () => { fixture.db = new PGlite(); await fixture.db.exec("create table sheet_rows(cohort text,email text,spreadsheet_id text,tab text,row_key text,payload jsonb,mirror_pending boolean default false,updated_at timestamptz default now(),unique(spreadsheet_id,tab,row_key));"); }, 60000);
afterAll(async () => { await fixture.db?.close(); });
beforeEach(async () => { await fixture.db!.exec("truncate sheet_rows"); });

it("지운 할 일만, 최근 지운 순으로, 내용째 돌려준다", async () => {
  await put("a", todo("a", "결과발표")); await put("b", todo("b", "서류 받기")); await put("c", todo("c", "살아 있음"));
  await clear("a", "2026-10-28T11:00:00Z"); await clear("b", "2026-10-28T12:00:00Z");
  const out = await readDeletedTodosFromDb("fixture-a");
  expect(out.map((x) => x.todo.제목)).toEqual(["서류 받기", "결과발표"]);
  expect(out[0]).toMatchObject({ deletedAt: "2026-10-28T12:00:00.000Z", todo: { id: "b", 업체명: "합성상사", 예정일자: "2026-11-02" } });
});
it("내용 없는 옛 삭제 행·다른 사람 시트는 보이지 않는다", async () => {
  await put("old", { _cleared: true }); await put("x", { ...todo("x", "남의 것"), _cleared: true }, "fixture-b");
  expect(await readDeletedTodosFromDb("fixture-a")).toEqual([]);
});
