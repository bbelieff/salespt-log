/**
 * Layer: service — 실무투두 유스케이스 (Scope 2).
 *
 * 05 실무투두 탭 CRUD. payment 슬롯 ToDo 섹션 + 캘린더(읽기)가 사용.
 * id/생성시각은 서버에서 생성 (호출 측은 도메인 필드만 전달).
 *
 * R3-2 쓰기 정본 전환(db-write-flip §2): 파일럿 기수 = DB 동기 저장(정본, 실패=throw·시트폴백 금지),
 * 읽기(listTodos)도 같은 게이트로 DB — 쓰기만 뒤집으면 read-your-writes 위반(적대 리뷰 r1 #1~3).
 * 그 외 기수 = R2 불변(시트 정본 + repo 내 비동기 DB 미러). 롤백 = chooseWriteSource 한 곳.
 *
 * 시트 미러 = **연산 재생이 아니라 수렴 동기화**(적대 리뷰 r2 — 재생 방식은 생성↔삭제 역전 좀비행,
 * append 재시도 중복, 미러 순서 역전, 행 없는 gcal 훅의 이벤트ID 유실을 낳음):
 *   • 쓰기 성공 시 queueSheetSync(시트별 직렬 큐)에 적재. 잡은 실행 시점의 **최신 DB 상태**를 읽어
 *     시트를 그 상태로 맞춘다(_cleared→행 클리어 / live→행 update-또는-append). 어떤 인터리빙도
 *     마지막 잡이 최신 상태로 수렴시키므로 레이스가 자기수정된다.
 *   • gcal 이벤트ID 맵은 시트 행(O열)에 저장되므로, gcal reconcile(onTodoChanged)은 잡 안에서
 *     **행 보장 후**에만 실행(행 없이 실행하면 이벤트ID 유실 → 지울 수 없는 고아 이벤트).
 *   • 미러 최종 실패는 저장 실패가 아님(정본=DB) — Sentry(sheet_mirror_error)로만 계수하고,
 *     다음 어떤 쓰기든 같은 행을 다시 최신 상태로 동기화한다(자기치유).
 */
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import {
  appendTodo,
  clearTodo,
  ensureTodoTab,
  findById as findTodoInSheet,
  findRowById,
  listTodosByContract,
  updateTodo as updateTodoRow,
} from "@/repo/todos";
import { chooseDailySource, chooseWriteSource } from "./daily-source";
import {
  clearRowInDb,
  dbEnabled,
  ensureSchema,
  getDbPool,
  writeRowToDb,
} from "@/repo/db/client";
import {
  clearMirrorPending,
  listMirrorPending,
  markMirrorPending,
} from "@/repo/db/mirror-pending";
import { readTodoRowStateFromDb, readTodosFromDb } from "@/repo/db/read-daily";
import { captureServerEvent } from "@/lib/analytics/api-timing";
import {
  onTodoChanged,
  onTodoCreated,
  reconcileTodoEvent,
  syncTodoRemoved,
} from "@/service/gcal-sync";
import { Todo } from "@/types";

interface SheetCtx {
  spreadsheetId: string;
  cohort: string;
  email: string;
}

async function resolveSheet(email: string): Promise<SheetCtx> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[todos] 등록되지 않은 사용자: ${email}`);
  if (!user.spreadsheetId) throw new Error(`[no-sheet] 개인 시트가 없는 계정: ${email}`);
  return { spreadsheetId: user.spreadsheetId, cohort: user.cohort, email };
}

// ── R3-2 시트 수렴 동기화 (DB 정본 경로 전용) ──────────────────────

/** 시트별 미러 잡 직렬화 — append 슬롯 경합·행별 순서 역전 방지 (프로세스 내). */
const sheetSyncTails = new Map<string, Promise<void>>();

/** DB 쓰기 성공 후 호출 — 해당 ToDo 행을 최신 DB 상태로 시트에 수렴시키는 잡을 적재.
 * 잡 끝에 같은 시트의 다른 pending 행도 재드라이브(§7-3 self-heal) — "다음 어떤 쓰기든"이 트리거. */
function queueSheetSync(ctx: SheetCtx, id: string): void {
  const key = ctx.spreadsheetId;
  const tail = (sheetSyncTails.get(key) ?? Promise.resolve())
    .then(() => runSheetSync(ctx, id))
    .then(() => drainPendingTodoSheet(ctx, id))
    .catch(() => {}); // runSheetSync 가 Sentry 계수 — 큐는 항상 전진
  sheetSyncTails.set(key, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(key) === tail) sheetSyncTails.delete(key);
  });
}

/** 1행 수렴 동기화 — 최신 DB 상태 기준. 선형 백오프 3회.
 * 성공(무예외 완료) → mirror_pending 해제. 최종 실패 → mirror_pending 마킹 + Sentry 계수(§2.2·§7-3). */
async function runSheetSync(ctx: SheetCtx, id: string): Promise<void> {
  const ref = { spreadsheetId: ctx.spreadsheetId, tab: "todos" as const, rowKey: id };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await syncTodoRowToSheet(ctx, id);
      // 시트가 최신 DB 상태로 수렴됨 — 밀린 표식 해제(없으면 저렴한 no-op).
      await clearMirrorPending(ref).catch(() => {});
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  // 정본은 이미 DB — 저장은 성공. 시트만 밀림 → durable 표식 남기고 다음 동기화가 흡수(§4).
  await markMirrorPending(ref).catch(() => {});
  Sentry.captureException(lastErr, { tags: { where: "todo-sheet-sync" } });
  captureServerEvent("sheet_mirror_error", { tab: "todos" });
}

/** 1회 시트 반영(최신 DB 상태) — 실패 시 throw(runSheetSync 가 재시도·표식 관리). */
async function syncTodoRowToSheet(ctx: SheetCtx, id: string): Promise<void> {
  // 05 탭 없는 시트(신규 수강생 첫 ToDo)에서 아래 range 읽기가 400 으로 죽지 않게 선보장(멱등).
  await ensureTodoTab(ctx.spreadsheetId);
  const state = await readTodoRowStateFromDb(ctx.spreadsheetId, id);
  if (!state) return; // DB 에 행 자체가 없음 — 동기화할 정본 없음
  if (state.cleared) {
    // 이벤트 삭제(맵은 행에 있으므로 클리어 전) → 행 클리어(없으면 no-op). 멱등.
    await syncTodoRemoved(ctx.spreadsheetId, id);
    await clearTodo(ctx.spreadsheetId, id, { mirror: false });
    return;
  }
  const todo = state.todo;
  if (!todo) return; // 파싱 불가 payload — 시트 반영 불가(정본 DB 는 그대로, 읽기도 DB)
  const { id: _drop, ...fields } = todo;
  void _drop;
  // 재시도 포함 update-or-append: 이전 시도의 append 가 커밋됐으면 다음 시도는 update 로 수렴(중복 방지).
  if ((await findRowById(ctx.spreadsheetId, id)) === null) {
    await appendTodo(ctx.spreadsheetId, todo, { mirror: false });
  } else {
    await updateTodoRow(ctx.spreadsheetId, id, fields, { mirror: false });
  }
  // 행 보장 후 gcal reconcile — **await 로 큐 직렬화 안에 가둠**(fire-and-forget 으로 탈출하면
  // 삭제 잡의 맵 읽기와 경합 → 이벤트ID 미기록 고아 이벤트). non-throwing(guard 내장).
  await reconcileTodoEvent(ctx.email, ctx.spreadsheetId, id, todo);
}

/** self-heal: 같은 시트의 밀린(mirror_pending) ToDo 행을 재드라이브. 1회 최대 25행(나머지는 다음 트리거).
 * 큐 직렬화 안에서 순차 실행 → 경합 없음. 각 runSheetSync 가 성공 시 해제·실패 시 재마킹(수렴). */
async function drainPendingTodoSheet(ctx: SheetCtx, justSyncedId: string): Promise<void> {
  if (!dbEnabled()) return;
  const keys = await listMirrorPending(ctx.spreadsheetId, "todos", 25).catch(() => []);
  for (const key of keys) {
    if (key === justSyncedId) continue; // 이번 패스에서 이미 동기화함
    await runSheetSync(ctx, key);
  }
}

// ── Public API ─────────────────────────────────────────────────

/** 한 계약(contractRef)의 ToDo 목록 (슬롯 ToDo 섹션용).
 * 파일럿 = DB 읽기(쓰기 정본과 동일 소스 → read-your-writes 보장). 그 외 = 시트(불변).
 * 정렬은 시트 append 순서 근사 = 생성시각 오름차순(동률은 id — 결정적). */
export async function listTodos(
  email: string,
  contractRef: string,
): Promise<Todo[]> {
  const ctx = await resolveSheet(email);
  if (chooseDailySource(ctx.cohort, dbEnabled()) === "db") {
    return (await readTodosFromDb(ctx.spreadsheetId))
      .filter((t) => t.contractRef === contractRef)
      .sort(
        (a, b) =>
          a.생성시각.localeCompare(b.생성시각) || a.id.localeCompare(b.id),
      );
  }
  return listTodosByContract(ctx.spreadsheetId, contractRef);
}

/** 생성 입력 — id/생성시각/완료여부는 서버 기본값. */
export type CreateTodoInput = Omit<Todo, "id" | "생성시각" | "완료여부">;

/** 생성 옵션 — operationId: 클라이언트가 초안당 1회 발행한 안정 키(UUID).
 * 있으면 Todo id 로 그대로 사용해 같은 scope+같은 operation 은 정확히 1행으로 수렴한다.
 * 없으면 기존 동작(서버 randomUUID) — 하위 호환. */
export interface CreateTodoOptions {
  operationId?: string;
}

/** 같은 operation 으로 이미 커밋된 행과 내용이 다를 때 — route 가 409 로 매핑. */
export class TodoOperationConflict extends Error {
  existing: Todo;
  constructor(existing: Todo) {
    super(`[todo-conflict] 같은 작업으로 이미 생성된 ToDo와 내용이 다릅니다: ${existing.id}`);
    this.name = "TodoOperationConflict";
    this.existing = existing;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 물질적 동일성 — id/생성시각/완료여부(서버 귀속) 제외, 업무 필드 전부 비교.
 * 제목·날짜만 같은 정상 중복(같은 할 일을 두 번 적기)은 여기서 걸리면 안 되므로
 * operation(행 id)이 다르면 무조건 별개 행이다. */
export function sameTodoBusiness(a: CreateTodoInput, b: Todo): boolean {
  return (
    a.contractRef === b.contractRef &&
    (a.institutionRef ?? "") === (b.institutionRef ?? "") &&
    (a.업체명 ?? "") === (b.업체명 ?? "") &&
    (a.type ?? "기타") === (b.type ?? "기타") &&
    (a.분류 ?? "") === (b.분류 ?? "") &&
    a.제목 === b.제목 &&
    a.예정일자 === b.예정일자 &&
    (a.예정시각 ?? "") === (b.예정시각 ?? "") &&
    (a.장소 ?? "") === (b.장소 ?? "") &&
    (a.상세 ?? "") === (b.상세 ?? "") &&
    (a.showOnCalendar ?? true) === (b.showOnCalendar ?? true)
  );
}

// 시트 경로 멱등 불가 고지 — Sheets API 에는 행 잠금·트랜잭션·unique 제약이 없어
// 조회-후-추가를 원자적으로 수행할 방법이 없다. 프로세스 내 직렬화 락은 같은
// 인스턴스의 동시 요청만 가두고, 다중 인스턴스·재시작 경합에는 아무 보장을 하지
// 않으므로 cross-process durable 하다고 주장하지 않는다. 안전하지 않은 생성을
// 수행하는 대신 operationId 있는 요청은 아래에서 거부한다(fail closed).
// operationId 없는 기존 호출자는 그대로 append 한다(하위 호환).

/** ToDo 1건 생성 (id=UUID, 생성시각=ISO, 완료여부=false).
 *
 * operationId 있음 = 멱등 경로: id=operationId 로 생성하고, 같은 키 재시도는
 * 원본 행을 그대로 반환(같은 업무값)하거나 409(TodoOperationConflict, 다른 업무값).
 * 서로 다른 operation 의 같은 업무값은 별개 행(정상 중복 허용).
 * 조회·생성은 전부 호출자 시트(spreadsheetId) 범위 — 타 학생 행을 반환하지 않는다. */
export async function createTodo(
  email: string,
  input: CreateTodoInput,
  opts: CreateTodoOptions = {},
): Promise<Todo> {
  const ctx = await resolveSheet(email);
  const { operationId } = opts;
  if (operationId !== undefined && !UUID_RE.test(operationId)) {
    throw new Error("[todos] operationId 형식 오류(UUID)");
  }
  if (!operationId) {
    const todo = Todo.parse({
      ...input,
      id: randomUUID(),
      완료여부: false,
      생성시각: new Date().toISOString(),
    });
    if (chooseWriteSource(ctx.cohort, dbEnabled()) === "db") {
      await writeRowToDb({ ...ctx, tab: "todos", rowKey: todo.id, payload: todo });
      queueSheetSync(ctx, todo.id); // 시트 반영 + (행 보장 후) gcal 등록
      return todo;
    }
    const saved = await appendTodo(ctx.spreadsheetId, todo);
    onTodoCreated(email, ctx.spreadsheetId, saved); // gcal 자동 등록(fire-and-forget)
    return saved;
  }

  const todo = Todo.parse({
    ...input,
    id: operationId,
    완료여부: false,
    생성시각: new Date().toISOString(),
  });
  if (chooseWriteSource(ctx.cohort, dbEnabled()) === "db") {
    // 기존 unique(spreadsheet_id, tab, row_key) 그대로 — 마이그레이션 없이 원자적 선점.
    // writeRowToDb(upsert·병합)는 재시도 시 생성시각을 덮어써 원본 반환을 깨므로
    // 멱등 경로에서는 쓰지 않는다.
    await ensureSchema();
    const res = await getDbPool().query(
      `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
       values ($1, $2, $3, 'todos', $4, $5::jsonb, now())
       on conflict (spreadsheet_id, tab, row_key) do nothing
       returning row_key`,
      [ctx.cohort, ctx.email, ctx.spreadsheetId, todo.id, JSON.stringify(todo)],
    );
    if ((res.rowCount ?? 0) > 0) {
      queueSheetSync(ctx, todo.id); // 시트 반영 + (행 보장 후) gcal 등록
      return todo;
    }
    // 패자/재시도 — 같은 시트 범위의 승자 행을 읽어 판정(타 학생 행 접근 불가).
    const state = await readTodoRowStateFromDb(ctx.spreadsheetId, todo.id);
    if (!state || (!state.todo && !state.cleared)) {
      throw new Error("[todos] 동시 생성 충돌 후 행을 찾지 못했습니다 — 다시 시도해주세요");
    }
    if (state.cleared || !state.todo) {
      throw new TodoOperationConflict(state.todo ?? todo);
    }
    if (!sameTodoBusiness(input, state.todo)) {
      throw new TodoOperationConflict(state.todo);
    }
    return state.todo; // 원본 그대로(최초 생성시각 보존) — gcal·미러 재발행 없음
  }

  // 시트 경로는 원자적 선점 수단이 없어 keyed 생성을 거부한다(fail closed).
  // 조회 실패를 null 로 삼켜 append 하면(구 코드의 .catch(() => null)) 읽지 못한
  // 기존 행과 중복된다. best-effort 조회-후-추가조차 다중 인스턴스에서 중복을
  // 막지 못하므로, operationId 가 있으면 생성 자체를 하지 않고 호출자에게
  // 알린다. 호출자는 키 없이 재호출(기존 동작)하거나 DB 파일럿 경로를 쓴다.
  // UI 는 이 오류를 실패로 표시하고 초안을 유지한다(중복 생성 없음).
  throw new Error(
    "[todos] 시트 저장소에서는 operationId 멱등 생성을 지원하지 않습니다 — " +
      "안전한 재시도가 불가해 생성을 거부합니다 (operationId 없이 호출하면 기존 방식으로 생성됩니다)",
  );
}

/** ToDo 부분 수정 (완료 토글·내용 변경 등). */
export async function patchTodo(
  email: string,
  id: string,
  partial: Partial<Omit<Todo, "id">>,
): Promise<void> {
  const ctx = await resolveSheet(email);
  if (chooseWriteSource(ctx.cohort, dbEnabled()) === "db") {
    // 병합기반 = DB(정본). "삭제됨(_cleared)" 과 "DB 공백" 을 구분 — 삭제된 ToDo 는 self-heal 금지
    // (시트 fallback 으로 200 을 주면 삭제가 조용히 무효화된 척 되고 gcal 이벤트가 부활 — r2 #3·#5).
    const state = await readTodoRowStateFromDb(ctx.spreadsheetId, id);
    if (state?.cleared) throw new Error(`[todos] 이미 삭제된 ToDo: ${id}`);
    let cur = state?.todo ?? undefined;
    // 진짜 DB 공백(R2 미러 best-effort 실패분)만 시트에서 self-heal — 아래 DB 쓰기가 공백을 메꾼다.
    if (!cur) cur = (await findTodoInSheet(ctx.spreadsheetId, id)) ?? undefined;
    if (!cur) throw new Error(`[todos] 존재하지 않는 ToDo: ${id}`);
    const merged = Todo.parse({ ...cur, ...partial });
    await writeRowToDb({ ...ctx, tab: "todos", rowKey: id, payload: merged });
    queueSheetSync(ctx, id); // 시트 반영 + gcal reconcile(잡 내부, 행 보장 후)
    return;
  }
  await updateTodoRow(ctx.spreadsheetId, id, partial); // 시트 정본(await)
  onTodoChanged(email, ctx.spreadsheetId, id); // gcal reconcile — 시트 재조회(fresh)
}

/** ToDo 삭제 (행 clear). */
export async function removeTodo(email: string, id: string): Promise<void> {
  const ctx = await resolveSheet(email);
  // 행 클리어 전 구글 이벤트 삭제(맵이 행에 있음) — 양 경로 동일. 멱등이라 DB 경로는 잡에서 한 번 더 수행.
  await syncTodoRemoved(ctx.spreadsheetId, id);
  if (chooseWriteSource(ctx.cohort, dbEnabled()) === "db") {
    await clearRowInDb({ ...ctx, tab: "todos", rowKey: id });
    queueSheetSync(ctx, id); // cleared 상태로 수렴(행 클리어·이벤트 재확인)
    return;
  }
  await clearTodo(ctx.spreadsheetId, id);
}
