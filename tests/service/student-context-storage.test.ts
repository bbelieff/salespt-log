import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/types";

const m = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findByDateRange: vi.fn(),
  findTodosByDateRange: vi.fn(),
  listTodosByContract: vi.fn(),
  listAllTodosFromSheet: vi.fn(),
  appendTodo: vi.fn(),
  updateTodo: vi.fn(),
  clearTodo: vi.fn(),
  ensureTodoTab: vi.fn(),
  findTodoInSheet: vi.fn(),
  findTodoRow: vi.fn(),
  dbEnabled: vi.fn(),
  readMeetingsFromDb: vi.fn(),
  readTodosFromDb: vi.fn(),
  readTodoRowStateFromDb: vi.fn(),
  writeRowToDb: vi.fn(),
  clearRowInDb: vi.fn(),
  ensureSchema: vi.fn(),
  poolQuery: vi.fn(),
  markMirrorPending: vi.fn(),
  clearMirrorPending: vi.fn(),
  listMirrorPending: vi.fn(),
  onTodoCreated: vi.fn(),
  onTodoChanged: vi.fn(),
  reconcileTodoEvent: vi.fn(),
  syncTodoRemoved: vi.fn(),
  captureServerEvent: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/repo/users", () => ({
  findUserByEmail: (...args: unknown[]) => m.findUserByEmail(...args),
}));
vi.mock("@/repo/meetings", () => ({
  findByDateRange: (...args: unknown[]) => m.findByDateRange(...args),
}));
vi.mock("@/repo/todos", () => ({
  findTodosByDateRange: (...args: unknown[]) => m.findTodosByDateRange(...args),
  listTodosByContract: (...args: unknown[]) => m.listTodosByContract(...args),
  listAllTodos: (...args: unknown[]) => m.listAllTodosFromSheet(...args),
  appendTodo: (...args: unknown[]) => m.appendTodo(...args),
  updateTodo: (...args: unknown[]) => m.updateTodo(...args),
  clearTodo: (...args: unknown[]) => m.clearTodo(...args),
  ensureTodoTab: (...args: unknown[]) => m.ensureTodoTab(...args),
  findById: (...args: unknown[]) => m.findTodoInSheet(...args),
  findRowById: (...args: unknown[]) => m.findTodoRow(...args),
}));
vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => m.dbEnabled(),
  writeRowToDb: (...args: unknown[]) => m.writeRowToDb(...args),
  clearRowInDb: (...args: unknown[]) => m.clearRowInDb(...args),
  ensureSchema: (...args: unknown[]) => m.ensureSchema(...args),
  getDbPool: () => ({ query: (...args: unknown[]) => m.poolQuery(...args) }),
}));
vi.mock("@/repo/db/read-daily", () => ({
  readMeetingsFromDb: (...args: unknown[]) => m.readMeetingsFromDb(...args),
  readTodosFromDb: (...args: unknown[]) => m.readTodosFromDb(...args),
  readTodoRowStateFromDb: (...args: unknown[]) => m.readTodoRowStateFromDb(...args),
}));
vi.mock("@/repo/db/mirror-pending", () => ({
  markMirrorPending: (...args: unknown[]) => m.markMirrorPending(...args),
  clearMirrorPending: (...args: unknown[]) => m.clearMirrorPending(...args),
  listMirrorPending: (...args: unknown[]) => m.listMirrorPending(...args),
}));
vi.mock("@/service/gcal-sync", () => ({
  onTodoCreated: (...args: unknown[]) => m.onTodoCreated(...args),
  onTodoChanged: (...args: unknown[]) => m.onTodoChanged(...args),
  reconcileTodoEvent: (...args: unknown[]) => m.reconcileTodoEvent(...args),
  syncTodoRemoved: (...args: unknown[]) => m.syncTodoRemoved(...args),
}));
vi.mock("@/lib/analytics/api-timing", () => ({
  captureServerEvent: (...args: unknown[]) => m.captureServerEvent(...args),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => m.captureException(...args),
}));

import { loadMonthMeetings } from "@/service/calendar";
import {
  createTodo,
  listAllTodos,
  listTodos,
  patchTodo,
  removeTodo,
} from "@/service/todos";

const TARGET_EMAIL = "legacy-alumni@example.test";
const TARGET_SHEET = "resolved-arena-sheet";
const RESELECTED_SHEET = "email-reselected-sheet";

const input = {
  contractRef: "contract-1",
  institutionRef: "",
  업체명: "테스트업체",
  type: "기타" as const,
  분류: "",
  제목: "자료 확인",
  예정일자: "2026-10-10",
  예정시각: "",
  장소: "",
  상세: "",
  showOnCalendar: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.dbEnabled.mockReturnValue(false);
  m.findUserByEmail.mockResolvedValue({
    email: TARGET_EMAIL,
    role: "trainee",
    status: "active",
    cohort: "1",
    spreadsheetId: RESELECTED_SHEET,
  });
  m.findByDateRange.mockResolvedValue(new Map());
  m.findTodosByDateRange.mockResolvedValue(new Map());
  m.listTodosByContract.mockResolvedValue([]);
  m.listAllTodosFromSheet.mockResolvedValue([]);
  m.appendTodo.mockImplementation(async (_sheet: string, todo: Todo) => todo);
  m.updateTodo.mockResolvedValue(undefined);
  m.clearTodo.mockResolvedValue(undefined);
  m.syncTodoRemoved.mockResolvedValue(undefined);
  m.onTodoCreated.mockResolvedValue(undefined);
  m.onTodoChanged.mockResolvedValue(undefined);
  m.reconcileTodoEvent.mockResolvedValue(undefined);
  m.ensureTodoTab.mockResolvedValue(undefined);
  m.findTodoRow.mockResolvedValue(1);
  m.markMirrorPending.mockResolvedValue(undefined);
  m.clearMirrorPending.mockResolvedValue(undefined);
  m.listMirrorPending.mockResolvedValue([]);
  m.readMeetingsFromDb.mockResolvedValue([]);
  m.readTodosFromDb.mockResolvedValue([]);
});

describe("student context storage target", () => {
  it("uses the explicit arena sheet for month reads and every todo operation", async () => {
    await loadMonthMeetings(TARGET_EMAIL, "2026-10", TARGET_SHEET);
    await listTodos(TARGET_EMAIL, "contract-1", TARGET_SHEET);
    await listAllTodos(TARGET_EMAIL, TARGET_SHEET);
    await createTodo(TARGET_EMAIL, input, { spreadsheetIdOverride: TARGET_SHEET });
    await patchTodo(TARGET_EMAIL, "todo-1", { 완료여부: true }, TARGET_SHEET);
    await removeTodo(TARGET_EMAIL, "todo-1", TARGET_SHEET);

    expect(m.findByDateRange).toHaveBeenCalledWith(TARGET_SHEET, expect.any(Array), "meeting");
    expect(m.findTodosByDateRange).toHaveBeenCalledWith(TARGET_SHEET, expect.any(Array));
    expect(m.listTodosByContract).toHaveBeenCalledWith(TARGET_SHEET, "contract-1");
    expect(m.listAllTodosFromSheet).toHaveBeenCalledWith(TARGET_SHEET);
    expect(m.appendTodo).toHaveBeenCalledWith(TARGET_SHEET, expect.anything());
    expect(m.updateTodo).toHaveBeenCalledWith(TARGET_SHEET, "todo-1", { 완료여부: true });
    expect(m.clearTodo).toHaveBeenCalledWith(TARGET_SHEET, "todo-1");
    expect(m.onTodoCreated).toHaveBeenCalledWith(TARGET_EMAIL, TARGET_SHEET, expect.anything());
    expect(m.onTodoChanged).toHaveBeenCalledWith(TARGET_EMAIL, TARGET_SHEET, "todo-1");
    expect(m.syncTodoRemoved).toHaveBeenCalledWith(TARGET_SHEET, "todo-1");
  });

  it("preserves ordinary email-selected storage when no override is supplied", async () => {
    await loadMonthMeetings(TARGET_EMAIL, "2026-10");
    await listAllTodos(TARGET_EMAIL);

    expect(m.findByDateRange).toHaveBeenCalledWith(RESELECTED_SHEET, expect.any(Array), "meeting");
    expect(m.findTodosByDateRange).toHaveBeenCalledWith(RESELECTED_SHEET, expect.any(Array));
    expect(m.listAllTodosFromSheet).toHaveBeenCalledWith(RESELECTED_SHEET);
  });

  it("keeps the DB-pilot source decision while reading the explicit sheet identity", async () => {
    m.dbEnabled.mockReturnValue(true);
    m.findUserByEmail.mockResolvedValue({
      email: TARGET_EMAIL,
      role: "trainee",
      status: "active",
      cohort: "8",
      spreadsheetId: RESELECTED_SHEET,
    });

    await loadMonthMeetings(TARGET_EMAIL, "2026-10", TARGET_SHEET);
    await listAllTodos(TARGET_EMAIL, TARGET_SHEET);

    expect(m.readMeetingsFromDb).toHaveBeenCalledWith(TARGET_SHEET);
    expect(m.readTodosFromDb).toHaveBeenCalledWith(TARGET_SHEET);
    expect(m.findByDateRange).not.toHaveBeenCalled();
    expect(m.findTodosByDateRange).not.toHaveBeenCalled();
    expect(m.listAllTodosFromSheet).not.toHaveBeenCalled();
  });
});
