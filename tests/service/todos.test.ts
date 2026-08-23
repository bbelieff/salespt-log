/**
 * R3-2 PR-1 (db-write-flip §7) — 05 실무투두 서비스 쓰기경로 회귀.
 * #535 는 게이트/롤백(daily-source.test.ts)만 커버했고 서비스 CRUD 행동엔 단위테스트가 0건이었다.
 * 여기서 고정하는 수용 기준(적대 리뷰 r1~r2 반영):
 *   ① 파일럿 = DB 동기 정본(writeRowToDb/clearRowInDb 정확 인자), 비파일럿 = R2 시트 완전 불변.
 *   ② patch 는 삭제됨(_cleared)→throw(부활 금지), DB·시트 모두 없음→throw, 있으면 병합 저장.
 *   ③ remove 는 행 클리어 **전** gcal 이벤트 삭제(맵이 행에 있음) — 순서 고정.
 *   ④ list(DB) 는 contractRef 필터 + 생성시각 오름차순(동률 id) 결정적 정렬.
 *   ⑤ 시트 미러 = 수렴(update-or-append) + 미러 실패는 저장 실패 아님(caller 성공·Sentry 계수).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";

// ── repo/service 경계 모킹 (daily-source 게이트는 실제 사용 — dbEnabled 만 모킹) ──
const findUserByEmail = vi.fn();
const writeRowToDb = vi.fn();
const clearRowInDb = vi.fn();
const dbEnabled = vi.fn(() => true);
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
}));
vi.mock("@/repo/db/read-daily", () => ({
  readTodoRowStateFromDb: (...a: unknown[]) => readTodoRowStateFromDb(...(a as [])),
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
  listTodos,
  patchTodo,
  removeTodo,
} from "@/service/todos";

const SHEET = "sheet-pilot";
const EMAIL = "u@x.y";

const mkTodo = (o: Partial<Todo> = {}): Todo => ({
  id: "t1",
  contractRef: "c1",
  institutionRef: "",
  업체명: "가나상사",
  type: "기타",
  제목: "서류 준비",
  예정일자: "2026-07-15",
  예정시각: "",
  장소: "",
  상세: "",
  showOnCalendar: true,
  완료여부: false,
  생성시각: "2026-07-10T00:00:00.000Z",
  분류: "",
  ...o,
});

/** 미러(fire-and-forget queueSheetSync)가 최신 DB 상태를 못 읽어 조용히 끝나게 하는 기본값. */
function idleMirror() {
  readTodoRowStateFromDb.mockResolvedValue(null);
}

beforeEach(() => {
  for (const m of [
    findUserByEmail, writeRowToDb, clearRowInDb, dbEnabled, readTodoRowStateFromDb,
    readTodosFromDb, appendTodo, updateTodo, clearTodo, ensureTodoTab, findById,
    findRowById, listTodosByContract, onTodoCreated, onTodoChanged,
    reconcileTodoEvent, syncTodoRemoved, captureServerEvent, captureException,
    markMirrorPending, clearMirrorPending, listMirrorPending,
  ]) m.mockReset();

  dbEnabled.mockReturnValue(true);
  markMirrorPending.mockResolvedValue(undefined);
  clearMirrorPending.mockResolvedValue(undefined);
  listMirrorPending.mockResolvedValue([]);
  findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "8", email: EMAIL });
  // 시트 미러/보장 훅 기본 = 성공(no-op). 개별 테스트가 override.
  ensureTodoTab.mockResolvedValue(undefined);
  appendTodo.mockImplementation(async (_id: string, t: Todo) => t);
  updateTodo.mockResolvedValue(undefined);
  clearTodo.mockResolvedValue(undefined);
  findRowById.mockResolvedValue(1);
  reconcileTodoEvent.mockResolvedValue(undefined);
  syncTodoRemoved.mockResolvedValue(undefined);
  writeRowToDb.mockResolvedValue(undefined);
  clearRowInDb.mockResolvedValue(undefined);
  idleMirror();
});

// 모듈 내부 직렬 큐(sheetSyncTails)에 남은 fire-and-forget 잡을 다음 테스트로 새지 않게 배수.
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10));
});

describe("createTodo — 파일럿 DB 정본 vs 비파일럿 시트 불변", () => {
  const input = { contractRef: "c1", 제목: "서류 준비", 예정일자: "2026-07-15" } as never;

  it("파일럿 = DB 동기 저장(tab=todos, rowKey=id, payload=todo) + 서버 기본값 채움", async () => {
    const todo = await createTodo(EMAIL, input);
    expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(todo.완료여부).toBe(false);
    expect(todo.생성시각).not.toBe("");
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      cohort: "8",
      email: EMAIL,
      tab: "todos",
      rowKey: todo.id,
      payload: todo,
    });
    // DB 경로는 시트 append 를 동기로 하지 않고(미러가 담당), gcal 은 onTodoCreated 대신 큐가 처리.
    expect(appendTodo).not.toHaveBeenCalled();
    expect(onTodoCreated).not.toHaveBeenCalled();
  });

  it("비파일럿(7기) = R2 시트 정본(appendTodo) + gcal onTodoCreated, DB 안 씀", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1", email: EMAIL });
    await createTodo(EMAIL, input);
    expect(appendTodo).toHaveBeenCalledTimes(1);
    expect(onTodoCreated).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).not.toHaveBeenCalled();
  });

  it("DATABASE_URL 미설정 = 파일럿도 시트(즉시 R2 복귀)", async () => {
    dbEnabled.mockReturnValue(false);
    await createTodo(EMAIL, input);
    expect(appendTodo).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).not.toHaveBeenCalled();
  });
});

describe("patchTodo — 삭제됨/부재 방어 + 병합 저장 (파일럿 DB)", () => {
  it("_cleared 상태 → throw(부활 금지), DB 저장 안 함", async () => {
    readTodoRowStateFromDb.mockResolvedValue({ cleared: true, todo: null });
    await expect(patchTodo(EMAIL, "t1", { 완료여부: true })).rejects.toThrow(
      "이미 삭제된 ToDo",
    );
    expect(writeRowToDb).not.toHaveBeenCalled();
  });

  it("DB·시트 모두 없음 → throw(존재하지 않음)", async () => {
    readTodoRowStateFromDb.mockResolvedValue(undefined);
    findById.mockResolvedValue(null);
    await expect(patchTodo(EMAIL, "t1", { 완료여부: true })).rejects.toThrow(
      "존재하지 않는 ToDo",
    );
    expect(writeRowToDb).not.toHaveBeenCalled();
  });

  it("DB 에 있으면 병합 후 저장 — 부분 필드만 덮어씀", async () => {
    const cur = mkTodo({ id: "t1", 완료여부: false, 제목: "원본" });
    readTodoRowStateFromDb.mockResolvedValue({ cleared: false, todo: cur });
    await patchTodo(EMAIL, "t1", { 완료여부: true });
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        rowKey: "t1",
        payload: expect.objectContaining({ id: "t1", 제목: "원본", 완료여부: true }),
      }),
    );
  });

  it("DB 공백이지만 시트에 있으면 self-heal(시트값으로 병합 저장)", async () => {
    readTodoRowStateFromDb.mockResolvedValue(undefined);
    findById.mockResolvedValue(mkTodo({ id: "t1", 제목: "시트원본" }));
    await patchTodo(EMAIL, "t1", { 제목: "수정" });
    expect(writeRowToDb).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ 제목: "수정" }) }),
    );
  });

  it("비파일럿 = 시트 update + gcal onTodoChanged, DB 안 씀", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1", email: EMAIL });
    await patchTodo(EMAIL, "t1", { 완료여부: true });
    expect(updateTodo).toHaveBeenCalledWith(SHEET, "t1", { 완료여부: true });
    expect(onTodoChanged).toHaveBeenCalledTimes(1);
    expect(writeRowToDb).not.toHaveBeenCalled();
    expect(readTodoRowStateFromDb).not.toHaveBeenCalled();
  });
});

describe("removeTodo — 이벤트 삭제 순서 + 경로별 정본", () => {
  it("파일럿 = gcal 이벤트 삭제가 clearRowInDb 보다 먼저(맵이 행에 있음)", async () => {
    const order: string[] = [];
    syncTodoRemoved.mockImplementation(async () => void order.push("gcal"));
    clearRowInDb.mockImplementation(async () => void order.push("db"));
    await removeTodo(EMAIL, "t1");
    expect(order).toEqual(["gcal", "db"]);
    expect(clearRowInDb).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      cohort: "8",
      email: EMAIL,
      tab: "todos",
      rowKey: "t1",
    });
  });

  it("비파일럿 = 시트 clearTodo, DB clearRowInDb 안 씀", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1", email: EMAIL });
    await removeTodo(EMAIL, "t1");
    expect(clearTodo).toHaveBeenCalledWith(SHEET, "t1");
    expect(clearRowInDb).not.toHaveBeenCalled();
  });
});

describe("listTodos — DB 경로 필터 + 결정적 정렬", () => {
  it("파일럿 = contractRef 필터 + 생성시각 오름차순(동률 id)", async () => {
    readTodosFromDb.mockResolvedValue([
      mkTodo({ id: "b", contractRef: "c1", 생성시각: "2026-07-11T00:00:00Z" }),
      mkTodo({ id: "z", contractRef: "c2", 생성시각: "2026-07-09T00:00:00Z" }), // 타 계약 — 제외
      mkTodo({ id: "a", contractRef: "c1", 생성시각: "2026-07-10T00:00:00Z" }),
      mkTodo({ id: "a2", contractRef: "c1", 생성시각: "2026-07-10T00:00:00Z" }), // a 와 동시각 → id 로 tie-break
    ]);
    const out = await listTodos(EMAIL, "c1");
    expect(out.map((t) => t.id)).toEqual(["a", "a2", "b"]);
    expect(listTodosByContract).not.toHaveBeenCalled();
  });

  it("비파일럿 = 시트 listTodosByContract, DB 안 읽음", async () => {
    findUserByEmail.mockResolvedValue({ spreadsheetId: SHEET, cohort: "1", email: EMAIL });
    listTodosByContract.mockResolvedValue([]);
    await listTodos(EMAIL, "c1");
    expect(listTodosByContract).toHaveBeenCalledWith(SHEET, "c1");
    expect(readTodosFromDb).not.toHaveBeenCalled();
  });
});

describe("시트 미러 = 수렴 동기화(fire-and-forget) + 실패 격리", () => {
  it("저장 후 최신 DB=live → 시트 행 없으면 append(mirror:false) + gcal reconcile await", async () => {
    // 미러 잡이 읽는 최신 상태 = 방금 저장한 todo(live).
    readTodoRowStateFromDb.mockResolvedValue({ cleared: false, todo: mkTodo({ id: "t1" }) });
    findRowById.mockResolvedValue(null); // 시트에 아직 행 없음 → append 로 수렴
    await createTodo(EMAIL, { contractRef: "c1", 제목: "x", 예정일자: "2026-07-15" } as never);
    await vi.waitFor(() => expect(appendTodo).toHaveBeenCalled());
    expect(appendTodo).toHaveBeenCalledWith(SHEET, expect.anything(), { mirror: false });
    expect(reconcileTodoEvent).toHaveBeenCalled();
  });

  it("최신 DB=_cleared → 시트 행 클리어(mirror:false) + 이벤트 삭제", async () => {
    readTodoRowStateFromDb.mockResolvedValue({ cleared: true, todo: null });
    await removeTodo(EMAIL, "t1");
    await vi.waitFor(() => expect(clearTodo).toHaveBeenCalled());
    expect(clearTodo).toHaveBeenCalledWith(SHEET, "t1", { mirror: false });
  });

  it("미러 실패는 저장 실패가 아님 — caller 성공 + Sentry 계수(sheet_mirror_error)", async () => {
    // 저장(writeRowToDb)은 성공, 미러 경로만 계속 실패.
    readTodoRowStateFromDb.mockRejectedValue(new Error("mirror read down"));
    await expect(
      createTodo(EMAIL, { contractRef: "c1", 제목: "x", 예정일자: "2026-07-15" } as never),
    ).resolves.toBeTruthy();
    await vi.waitFor(
      () => expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "todos" }),
      { timeout: 3000 },
    );
    expect(captureException).toHaveBeenCalled();
  });
});

// ── §7-3 mirror_pending 안전망 (수용 기준: DB성공·시트실패 → 응답 성공 + mirror_pending) ──
describe("mirror_pending 안전망 (§7-3)", () => {
  const input = { contractRef: "c1", 제목: "x", 예정일자: "2026-07-15" } as never;

  it("시트 미러 최종 실패 → 응답 성공 + markMirrorPending(tab=todos) (해제는 호출 안 함)", async () => {
    readTodoRowStateFromDb.mockResolvedValue({ cleared: false, todo: mkTodo({ id: "t1" }) });
    findRowById.mockResolvedValue(1); // 시트 행 있음 → update 경로
    updateTodo.mockRejectedValue(new Error("sheet 500"));
    const todo = await createTodo(EMAIL, input); // 응답은 즉시 성공(미러는 fire-and-forget)
    await vi.waitFor(() => expect(markMirrorPending).toHaveBeenCalled(), { timeout: 3000 });
    expect(markMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "todos",
      rowKey: todo.id,
    });
    expect(clearMirrorPending).not.toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith("sheet_mirror_error", { tab: "todos" });
  });

  it("시트 미러 성공 → clearMirrorPending(tab=todos) (마킹은 호출 안 함)", async () => {
    readTodoRowStateFromDb.mockResolvedValue({ cleared: false, todo: mkTodo({ id: "t1" }) });
    findRowById.mockResolvedValue(1); // update 성공(기본 mock)
    const todo = await createTodo(EMAIL, input);
    await vi.waitFor(() => expect(clearMirrorPending).toHaveBeenCalled());
    expect(clearMirrorPending).toHaveBeenCalledWith({
      spreadsheetId: SHEET,
      tab: "todos",
      rowKey: todo.id,
    });
    expect(markMirrorPending).not.toHaveBeenCalled();
  });

  it("다음 쓰기의 queueSheetSync 가 밀린 pending 행을 재드라이브(self-heal) → 성공 시 해제", async () => {
    listMirrorPending.mockResolvedValueOnce(["t-old"]);
    readTodoRowStateFromDb.mockResolvedValue({ cleared: false, todo: mkTodo({ id: "t-old" }) });
    findRowById.mockResolvedValue(1);
    await createTodo(EMAIL, input);
    await vi.waitFor(() =>
      expect(clearMirrorPending).toHaveBeenCalledWith({
        spreadsheetId: SHEET,
        tab: "todos",
        rowKey: "t-old",
      }),
    );
  });
});
