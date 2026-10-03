/**
 * Scope C2 — POST /api/todos 서버 멱등(operationId) 회귀.
 *
 * 수용 기준(PARENT-REVIEW + REPORT-C 후속, C3 갱신):
 *  ① 커밋 후 응답 유실 → 같은 operation·같은 내용 재시도는 원본 1행을 그대로 반환(중복 0).
 *  ② 동시 같은 키(DB 원자 선점) → 1행으로 수렴, 둘 다 같은 결과.
 *  ③ 다른 operation 의 같은 업무값(같은 제목·날짜)은 별개 행 — 정상 중복 허용.
 *  ④ 같은 operation 의 다른 업무값은 409(TodoOperationConflict), 원본 불변.
 *  ⑤ 범위 격리 — 같은 키라도 학생(시트) 다르면 별개 행, 재시도가 타 학생 행을 반환 금지.
 *  ⑥ operationId 없으면 기존 동작 그대로(서버 발행 id, 하위 호환).
 *
 * DB 경로는 기존 unique(spreadsheet_id, tab, row_key) 를 INSERT ... DO NOTHING 으로
 * 그대로 쓰므로 마이그레이션 없이 원자적이다. 시트 경로는 Sheets API 에 잠금·
 * 트랜잭션·unique 제약이 없어 원자적 선점이 불가하므로, operationId 있는 생성은
 * 거부한다(fail closed) — 프로세스 내 락을 cross-process 보장으로 주장하지 않는다.
 * ①~⑤는 DB 경로에서 검증, 시트 경로는 거부·무생성·무키 하위호환을 검증한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";

// ── repo/service 경계 모킹 (todos.test.ts 와 동일 + 멱등 INSERT용 getDbPool) ──
const findUserByEmail = vi.fn();
const writeRowToDb = vi.fn();
const clearRowInDb = vi.fn();
const dbEnabled = vi.fn(() => true);
const ensureSchema = vi.fn();
const poolQuery = vi.fn();
const readTodoRowStateFromDb = vi.fn();
const readTodosFromDb = vi.fn();
const appendTodo = vi.fn();
const updateTodo = vi.fn();
const clearTodo = vi.fn();
const ensureTodoTab = vi.fn();
const findById = vi.fn();
const findRowById = vi.fn();
const listTodosByContract = vi.fn();
const onTodoCreated = vi.fn();
const onTodoChanged = vi.fn();
const reconcileTodoEvent = vi.fn();
const syncTodoRemoved = vi.fn();
const captureServerEvent = vi.fn();
const captureException = vi.fn();
const markMirrorPending = vi.fn();
const clearMirrorPending = vi.fn();
const listMirrorPending = vi.fn();

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...a: unknown[]) => findUserByEmail(...(a as [])),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: (...a: unknown[]) => dbEnabled(...(a as [])),
  writeRowToDb: (...a: unknown[]) => writeRowToDb(...(a as [])),
  clearRowInDb: (...a: unknown[]) => clearRowInDb(...(a as [])),
  ensureSchema: (...a: unknown[]) => ensureSchema(...(a as [])),
  getDbPool: () => ({ query: (...a: unknown[]) => poolQuery(...(a as [])) }),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readTodoRowStateFromDb: (...a: unknown[]) =>
    readTodoRowStateFromDb(...(a as [])),
  readTodosFromDb: (...a: unknown[]) => readTodosFromDb(...(a as [])),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: (...a: unknown[]) => markMirrorPending(...(a as [])),
  clearMirrorPending: (...a: unknown[]) => clearMirrorPending(...(a as [])),
  listMirrorPending: (...a: unknown[]) => listMirrorPending(...(a as [])),
}));
vi.mock("@/repo/todos", () => ({
  appendTodo: (...a: unknown[]) => appendTodo(...(a as [])),
  updateTodo: (...a: unknown[]) => updateTodo(...(a as [])),
  clearTodo: (...a: unknown[]) => clearTodo(...(a as [])),
  ensureTodoTab: (...a: unknown[]) => ensureTodoTab(...(a as [])),
  findById: (...a: unknown[]) => findById(...(a as [])),
  findRowById: (...a: unknown[]) => findRowById(...(a as [])),
  listTodosByContract: (...a: unknown[]) => listTodosByContract(...(a as [])),
}));
vi.mock("@/service/gcal-sync", () => ({
  onTodoCreated: (...a: unknown[]) => onTodoCreated(...(a as [])),
  onTodoChanged: (...a: unknown[]) => onTodoChanged(...(a as [])),
  reconcileTodoEvent: (...a: unknown[]) => reconcileTodoEvent(...(a as [])),
  syncTodoRemoved: (...a: unknown[]) => syncTodoRemoved(...(a as [])),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...(a as [])),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...(a as [])),
}));

import {
  createTodo,
  sameTodoBusiness,
  TodoOperationConflict,
  type CreateTodoInput,
} from "@/service/todos";

const SHEET_A = "sheet-student-a";
const SHEET_B = "sheet-student-b";
const EMAIL_A = "a@x.y";
const EMAIL_B = "b@x.y";
const OP1 = "11111111-1111-4111-8111-111111111111";
const OP2 = "22222222-2222-4222-8222-222222222222";

const input: CreateTodoInput = {
  contractRef: "2026-07-10|가나상사",
  institutionRef: "미소재단",
  업체명: "가나상사",
  type: "기타",
  분류: "",
  제목: "서류 준비",
  예정일자: "2026-07-15",
  예정시각: "",
  장소: "",
  상세: "",
  showOnCalendar: false,
};

// ── 가짜 저장소: DB unique(spreadsheet_id, tab, row_key) 의미론 그대로 ──
let dbRows: Map<string, Todo>;
let sheetRows: Map<string, Map<string, Todo>>;

function dbKey(spreadsheetId: string, rowKey: string) {
  return `${spreadsheetId}\ttodos\t${rowKey}`;
}

beforeEach(() => {
  for (const m of [
    findUserByEmail, writeRowToDb, clearRowInDb, dbEnabled, ensureSchema,
    poolQuery, readTodoRowStateFromDb, readTodosFromDb, appendTodo, updateTodo,
    clearTodo, ensureTodoTab, findById, findRowById, listTodosByContract,
    onTodoCreated, onTodoChanged, reconcileTodoEvent, syncTodoRemoved,
    captureServerEvent, captureException, markMirrorPending, clearMirrorPending,
    listMirrorPending,
  ]) m.mockReset();

  dbRows = new Map();
  sheetRows = new Map();
  dbEnabled.mockReturnValue(true);
  ensureSchema.mockResolvedValue(undefined);
  markMirrorPending.mockResolvedValue(undefined);
  clearMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
  findUserByEmail.mockImplementation(async (email: string) => ({
    spreadsheetId: email === EMAIL_B ? SHEET_B : SHEET_A,
    cohort: "8",
    email,
  }));
  ensureTodoTab.mockResolvedValue(undefined);
  reconcileTodoEvent.mockResolvedValue(undefined);
  syncTodoRemoved.mockResolvedValue(undefined);
  writeRowToDb.mockResolvedValue(undefined);
  clearRowInDb.mockResolvedValue(undefined);
  onTodoCreated.mockReturnValue(undefined);

  // 멱등 INSERT ... ON CONFLICT DO NOTHING 의미론.
  poolQuery.mockImplementation(async (sql: string, params: unknown[]) => {
    if (typeof sql === "string" && sql.includes("on conflict") && sql.includes("do nothing")) {
      const [, , spreadsheetId, rowKey, payloadJson] = params as [
        unknown, unknown, string, string, string,
      ];
      const k = dbKey(spreadsheetId, rowKey);
      if (dbRows.has(k)) return { rowCount: 0 };
      dbRows.set(k, JSON.parse(payloadJson) as Todo);
      return { rowCount: 1 };
    }
    throw new Error(`unexpected SQL in test: ${String(sql).slice(0, 60)}`);
  });
  readTodoRowStateFromDb.mockImplementation(
    async (spreadsheetId: string, id: string) => {
      const todo = dbRows.get(dbKey(spreadsheetId, id));
      if (!todo) return null;
      return { cleared: false, todo };
    },
  );

  // 시트 경로 — 시트별 id 맵.
  const sheetOf = (spreadsheetId: string) => {
    let m = sheetRows.get(spreadsheetId);
    if (!m) {
      m = new Map();
      sheetRows.set(spreadsheetId, m);
    }
    return m;
  };
  findById.mockImplementation(async (spreadsheetId: string, id: string) => {
    return sheetOf(spreadsheetId).get(id) ?? null;
  });
  findRowById.mockImplementation(async (spreadsheetId: string, id: string) => {
    return sheetOf(spreadsheetId).has(id) ? 2 : null;
  });
  appendTodo.mockImplementation(async (spreadsheetId: string, todo: Todo) => {
    sheetOf(spreadsheetId).set(todo.id, todo);
    return todo;
  });
  updateTodo.mockResolvedValue(undefined);
  clearTodo.mockResolvedValue(undefined);
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10));
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("sameTodoBusiness — 물질적 동일성", () => {
  it("같은 업무값은 true — 서버 귀속(id/생성시각/완료여부)은 무시", () => {
    const existing = {
      ...input,
      id: OP1,
      완료여부: true,
      생성시각: "2026-07-10T00:00:00.000Z",
    } as Todo;
    expect(sameTodoBusiness(input, existing)).toBe(true);
  });
  it("제목·날짜 하나라도 다르면 false", () => {
    const base = { ...input, id: OP1, 완료여부: false, 생성시각: "" } as Todo;
    expect(sameTodoBusiness(input, { ...base, 제목: "다른 일" })).toBe(false);
    expect(
      sameTodoBusiness(input, { ...base, 예정일자: "2026-07-16" }),
    ).toBe(false);
  });
});

describe("DB 경로 멱등 — 커밋 후 응답 유실·동시 같은 키", () => {
  it("같은 operation·같은 내용 재시도는 원본 1행을 그대로 반환", async () => {
    const first = await createTodo(EMAIL_A, input, { operationId: OP1 });
    expect(first.id).toBe(OP1);
    // 응답 유실 흉내 — 클라이언트는 성공을 못 보고 같은 키·같은 내용으로 재시도.
    const retry = await createTodo(EMAIL_A, input, { operationId: OP1 });
    expect(retry.id).toBe(OP1);
    expect(retry.생성시각).toBe(first.생성시각);
    expect(dbRows.size).toBe(1);
    // 멱등 경로는 upsert 병합(writeRowToDb)을 쓰지 않는다 — 원본 보존.
    expect(writeRowToDb).not.toHaveBeenCalled();
    // DB 경로는 gcal 을 onTodoCreated 가 아니라 미러 잡(reconcile)이 처리한다.
    // 재시도는 미러 잡을 추가 적재하지 않는다 — 최초 1회만 수렴한다.
    expect(onTodoCreated).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(appendTodo).toHaveBeenCalled());
    for (const call of appendTodo.mock.calls) {
      expect(call[1]).toMatchObject({ id: OP1 });
      expect(call[2]).toEqual({ mirror: false });
    }
    await vi.waitFor(() => expect(reconcileTodoEvent).toHaveBeenCalled());
    expect(reconcileTodoEvent).toHaveBeenCalledTimes(1);
  });

  it("동시 같은 키 2요청은 1행으로 수렴하고 같은 결과를 돌려준다", async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => {
      releaseFirst = r;
    });
    let inserts = 0;
    poolQuery.mockImplementation(async (sql: string, params: unknown[]) => {
      inserts++;
      if (inserts === 1) await gate; // 첫 INSERT 를 붙잡고 두 번째를 먼저 통과시킴
      const [, , spreadsheetId, rowKey, payloadJson] = params as [
        unknown, unknown, string, string, string,
      ];
      const k = dbKey(spreadsheetId, rowKey);
      if (dbRows.has(k)) return { rowCount: 0 };
      dbRows.set(k, JSON.parse(payloadJson) as Todo);
      return { rowCount: 1 };
    });
    const p1 = createTodo(EMAIL_A, input, { operationId: OP1 });
    const p2 = createTodo(EMAIL_A, input, { operationId: OP1 });
    await new Promise((r) => setTimeout(r, 10));
    releaseFirst();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.id).toBe(OP1);
    expect(r2.id).toBe(OP1);
    expect(r1.생성시각).toBe(r2.생성시각);
    expect(dbRows.size).toBe(1);
  });

  it("다른 operation 의 같은 업무값은 별개 행 — 정상 중복 허용", async () => {
    const r1 = await createTodo(EMAIL_A, input, { operationId: OP1 });
    const r2 = await createTodo(EMAIL_A, input, { operationId: OP2 });
    expect(r1.id).not.toBe(r2.id);
    expect(dbRows.size).toBe(2);
  });

  it("같은 operation 의 다른 업무값은 409 — 원본 불변", async () => {
    const first = await createTodo(EMAIL_A, input, { operationId: OP1 });
    const err = await createTodo(EMAIL_A, { ...input, 제목: "바꾼 제목" }, {
      operationId: OP1,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(TodoOperationConflict);
    expect(String(err.message)).toMatch(/^\[todo-conflict\]/);
    expect((err as TodoOperationConflict).existing.id).toBe(OP1);
    expect(dbRows.size).toBe(1);
    expect(dbRows.get(dbKey(SHEET_A, OP1))?.제목).toBe(first.제목);
  });

  it("같은 키라도 학생(시트)이 다르면 별개 행 — 재시도가 타 학생 행을 반환 금지", async () => {
    const a1 = await createTodo(EMAIL_A, input, { operationId: OP1 });
    const b1 = await createTodo(EMAIL_B, input, { operationId: OP1 });
    expect(a1.id).toBe(OP1);
    expect(b1.id).toBe(OP1);
    expect(dbRows.size).toBe(2);
    const aRetry = await createTodo(EMAIL_A, input, { operationId: OP1 });
    expect(aRetry.생성시각).toBe(a1.생성시각);
    expect(dbRows.get(dbKey(SHEET_B, OP1))?.생성시각).toBe(b1.생성시각);
  });

  it("operationId 없으면 기존 동작 — 서버 발행 UUID + writeRowToDb", async () => {
    const todo = await createTodo(EMAIL_A, input);
    expect(todo.id).toMatch(UUID_RE);
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "todos", rowKey: todo.id }),
    );
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("operationId 형식 오류는 저장 전에 거부", async () => {
    await expect(
      createTodo(EMAIL_A, input, { operationId: "not-a-uuid" }),
    ).rejects.toThrow("operationId 형식 오류");
    expect(dbRows.size).toBe(0);
  });
});

describe("시트 경로 — operationId 멱등 불가, keyed 생성 거부 (fail closed, C3)", () => {
  beforeEach(() => {
    findUserByEmail.mockImplementation(async (email: string) => ({
      spreadsheetId: email === EMAIL_B ? SHEET_B : SHEET_A,
      cohort: "1",
      email,
    }));
  });

  it("operationId 있는 생성은 거부한다 — 조회·append 없이 useful error", async () => {
    await expect(
      createTodo(EMAIL_A, input, { operationId: OP1 }),
    ).rejects.toThrow(/operationId 멱등 생성을 지원하지 않습니다/);
    // 안전하지 않은 생성을 수행하지 않는다 — 시트 조회·추가 모두 미호출.
    expect(findById).not.toHaveBeenCalled();
    expect(appendTodo).not.toHaveBeenCalled();
    expect(onTodoCreated).not.toHaveBeenCalled();
    expect(sheetRows.get(SHEET_A)?.size ?? 0).toBe(0);
  });

  it("조회 실패가 중복 append 로 이어지지 않는다 — 실패를 삼키지 않는다", async () => {
    findById.mockRejectedValueOnce(new Error("sheet read down"));
    await expect(
      createTodo(EMAIL_A, input, { operationId: OP1 }),
    ).rejects.toThrow(/operationId 멱등 생성을 지원하지 않습니다/);
    expect(appendTodo).not.toHaveBeenCalled();
    expect(sheetRows.get(SHEET_A)?.size ?? 0).toBe(0);
  });

  it("operationId 없으면 기존 동작 그대로 — 서버 발행 id 로 append (하위 호환)", async () => {
    const todo = await createTodo(EMAIL_A, input);
    expect(todo.id).toMatch(UUID_RE);
    expect(appendTodo).toHaveBeenCalledTimes(1);
    expect(onTodoCreated).toHaveBeenCalledTimes(1);
    expect(sheetRows.get(SHEET_A)!.size).toBe(1);
  });
});
