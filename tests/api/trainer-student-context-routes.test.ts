import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => {
  class ContextError extends Error {
    constructor(public code: string, public status: 401 | 403) {
      super(code);
    }
  }
  return {
    ContextError,
    requireContext: vi.fn(),
    resolveContext: vi.fn(),
    getWritableUserEmail: vi.fn(),
    getCurrentUserEmail: vi.fn(),
    setArenaSelfView: vi.fn(),
    getSessionEmail: vi.fn(),
    getEffectiveRole: vi.fn(),
    isAdminEmail: vi.fn(),
    findUserByEmail: vi.fn(),
    loadMe: vi.fn(),
    loadDay: vi.fn(),
    saveContactMetrics: vi.fn(),
    loadWeekMeetings: vi.fn(),
    loadMonthMeetings: vi.fn(),
    listAllTodos: vi.fn(),
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    patchTodo: vi.fn(),
    removeTodo: vi.fn(),
    TodoConflict: class extends Error {},
  };
});

vi.mock("@/auth/identity", () => ({
  requireStudentViewContext: m.requireContext,
  resolveStudentViewContext: m.resolveContext,
  getWritableUserEmail: m.getWritableUserEmail,
  setArenaSelfView: m.setArenaSelfView,
  getSessionEmail: m.getSessionEmail,
  getEffectiveRole: m.getEffectiveRole,
  isAdminEmail: m.isAdminEmail,
  StudentViewContextError: m.ContextError,
}));
vi.mock("@/auth/stub", () => ({
  getCurrentUserEmail: m.getCurrentUserEmail,
}));
vi.mock("@/service", () => ({
  loadMe: m.loadMe,
  loadDay: m.loadDay,
  saveContactMetrics: m.saveContactMetrics,
  loadWeekMeetings: m.loadWeekMeetings,
  loadMonthMeetings: m.loadMonthMeetings,
  listAllTodos: m.listAllTodos,
  listTodos: m.listTodos,
  createTodo: m.createTodo,
  patchTodo: m.patchTodo,
  removeTodo: m.removeTodo,
  TodoOperationConflict: m.TodoConflict,
}));
vi.mock("@/repo/users", () => ({ findUserByEmail: m.findUserByEmail }));
vi.mock("@/lib/analytics/api-timing", () => ({
  withApiTiming: (_label: string, handler: unknown) => handler,
}));

import { GET as dailyGET, POST as dailyPOST } from "@/app/api/daily/[date]/route";
import { GET as weekGET } from "@/app/api/meetings/week/[weekStart]/route";
import { GET as monthGET } from "@/app/api/meetings/month/[yyyymm]/route";
import { GET as todosGET, POST as todosPOST } from "@/app/api/todos/route";
import { DELETE as todoDELETE, PATCH as todoPATCH } from "@/app/api/todos/[id]/route";
import { POST as arenaSelfPOST } from "@/app/api/arena-self/route";
import { GET as meGET } from "@/app/api/me/route";

const request = new Request("https://app.example.test/api/test") as never;

describe("student-context protected routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getSessionEmail.mockResolvedValue("trainer@example.test");
    m.getEffectiveRole.mockResolvedValue({ role: "trainer", status: "active" });
    m.isAdminEmail.mockReturnValue(false);
    m.findUserByEmail.mockResolvedValue({ role: "trainer", status: "active" });
    m.getWritableUserEmail.mockResolvedValue("legacy-alumni@example.test");
    m.getCurrentUserEmail.mockResolvedValue("trainer@example.test");
    m.loadMonthMeetings.mockResolvedValue({ yyyyMM: "2026-10", daysByMeetingDate: [], daysByTodoDate: [] });
    m.listAllTodos.mockResolvedValue([]);
    m.listTodos.mockResolvedValue([]);
    m.createTodo.mockResolvedValue({ id: "todo-1" });
    m.patchTodo.mockResolvedValue(undefined);
    m.removeTodo.mockResolvedValue(undefined);
  });

  it.each([
    ["unauthenticated", 401],
    ["invalid_student_target", 403],
    ["student_target_required", 403],
    ["student_view_forbidden", 403],
  ])("returns stable non-PII %s", async (code, status) => {
    m.requireContext.mockRejectedValue(new m.ContextError(code, status as 401 | 403));

    const response = await dailyGET(request, {
      params: Promise.resolve({ date: "2026-10-10" }),
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code, code });
    expect(m.loadDay).not.toHaveBeenCalled();
  });

  it("uses the resolved assigned target for daily and weekly reads", async () => {
    m.requireContext.mockResolvedValue({
      ok: true,
      mode: "assigned",
      email: "student@example.test",
    });
    m.loadDay.mockResolvedValue({ date: "2026-10-10" });
    m.loadWeekMeetings.mockResolvedValue({ weekStart: "2026-10-09" });

    const daily = await dailyGET(request, {
      params: Promise.resolve({ date: "2026-10-10" }),
    });
    const week = await weekGET(request, {
      params: Promise.resolve({ weekStart: "2026-10-09" }),
    });

    expect(daily.status).toBe(200);
    expect(week.status).toBe(200);
    expect(m.loadDay).toHaveBeenCalledWith("student@example.test", "2026-10-10");
    expect(m.loadWeekMeetings).toHaveBeenCalledWith(
      "student@example.test",
      "2026-10-09",
    );
  });

  it("uses the actual arena trainee identity for daily/week reads and daily writes", async () => {
    const email = "legacy-alumni@example.test";
    m.requireContext.mockResolvedValue({
      ok: true,
      mode: "arena",
      email,
      sheetOverride: "legacy-sheet",
    });
    m.loadDay.mockResolvedValue({ date: "2026-10-10" });
    m.loadWeekMeetings.mockResolvedValue({ weekStart: "2026-10-09" });
    m.saveContactMetrics.mockResolvedValue({ source: "sheet" });

    await dailyGET(request, {
      params: Promise.resolve({ date: "2026-10-10" }),
    });
    await weekGET(request, {
      params: Promise.resolve({ weekStart: "2026-10-09" }),
    });
    const metrics = Object.fromEntries(
      ["매입DB", "직접생산", "현수막", "콜·지·기·소"].map((channel) => [
        channel,
        { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 },
      ]),
    );
    const written = await dailyPOST(
      new Request("https://app.example.test/api/daily/2026-10-10", {
        method: "POST",
        body: JSON.stringify(metrics),
      }) as never,
      { params: Promise.resolve({ date: "2026-10-10" }) },
    );

    expect(written.status).toBe(200);
    expect(m.loadDay).toHaveBeenCalledWith(email, "2026-10-10");
    expect(m.loadWeekMeetings).toHaveBeenCalledWith(email, "2026-10-09");
    expect(m.saveContactMetrics).toHaveBeenCalledWith(email, "2026-10-10", metrics);
  });

  it("keeps all daily/week loaders at zero when arena authority fails closed", async () => {
    m.requireContext.mockRejectedValue(
      new m.ContextError("student_view_forbidden", 403),
    );
    const metrics = Object.fromEntries(
      ["매입DB", "직접생산", "현수막", "콜·지·기·소"].map((channel) => [
        channel,
        { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 },
      ]),
    );

    const daily = await dailyGET(request, {
      params: Promise.resolve({ date: "2026-10-10" }),
    });
    const week = await weekGET(request, {
      params: Promise.resolve({ weekStart: "2026-10-09" }),
    });
    const write = await dailyPOST(
      new Request("https://app.example.test/api/daily/2026-10-10", {
        method: "POST",
        body: JSON.stringify(metrics),
      }) as never,
      { params: Promise.resolve({ date: "2026-10-10" }) },
    );

    expect([daily.status, week.status, write.status]).toEqual([403, 403, 403]);
    expect(m.loadDay).not.toHaveBeenCalled();
    expect(m.loadWeekMeetings).not.toHaveBeenCalled();
    expect(m.getWritableUserEmail).not.toHaveBeenCalled();
    expect(m.saveContactMetrics).not.toHaveBeenCalled();
  });

  it("does not expose an internal failure", async () => {
    m.requireContext.mockResolvedValue({ ok: true, mode: "assigned", email: "student@example.test" });
    m.loadDay.mockRejectedValue(new Error("private email or sheet detail"));

    const response = await dailyGET(request, {
      params: Promise.resolve({ date: "2026-10-10" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "student_view_unavailable",
      code: "student_view_unavailable",
    });
  });

  it("validates self-view before setting the flag and safely clears it", async () => {
    m.resolveContext.mockResolvedValue({
      ok: false,
      status: 403,
      code: "student_view_forbidden",
    });
    const denied = await arenaSelfPOST(
      new Request("https://app.example.test/api/arena-self", {
        method: "POST",
        body: JSON.stringify({ on: true }),
      }),
    );
    expect(denied.status).toBe(403);
    expect(m.setArenaSelfView).not.toHaveBeenCalled();

    const cleared = await arenaSelfPOST(
      new Request("https://app.example.test/api/arena-self", {
        method: "POST",
        body: JSON.stringify({ on: false }),
      }),
    );
    expect(cleared.status).toBe(200);
    expect(m.setArenaSelfView).toHaveBeenCalledWith(false);
  });

  it("keeps /api/me on the same stable context denial", async () => {
    m.resolveContext.mockResolvedValue({
      ok: false,
      status: 403,
      code: "invalid_student_target",
    });

    const response = await meGET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_student_target",
      code: "invalid_student_target",
    });
    expect(m.loadMe).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthenticated", 401],
    ["invalid_student_target", 403],
    ["student_target_required", 403],
  ])("blocks every B2 route before service on %s", async (code, status) => {
    m.requireContext.mockRejectedValue(new m.ContextError(code, status as 401 | 403));

    const responses = await Promise.all([
      monthGET(request, { params: Promise.resolve({ yyyymm: "2026-10" }) }),
      todosGET(new NextRequest("https://app.example.test/api/todos?all=1") as never),
      todosPOST(new NextRequest("https://app.example.test/api/todos", {
        method: "POST",
        body: JSON.stringify({ contractRef: "contract-1", 제목: "할 일", 예정일자: "2026-10-10" }),
      }) as never),
      todoPATCH(new Request("https://app.example.test/api/todos/todo-1", {
        method: "PATCH",
        body: JSON.stringify({ 완료여부: true }),
      }) as never, { params: Promise.resolve({ id: "todo-1" }) }),
      todoDELETE(request, { params: Promise.resolve({ id: "todo-1" }) }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      status,
      status,
      status,
      status,
      status,
    ]);
    for (const response of responses) {
      await expect(response.json()).resolves.toMatchObject({ error: code, code });
    }
    expect(m.loadMonthMeetings).not.toHaveBeenCalled();
    expect(m.listAllTodos).not.toHaveBeenCalled();
    expect(m.listTodos).not.toHaveBeenCalled();
    expect(m.createTodo).not.toHaveBeenCalled();
    expect(m.patchTodo).not.toHaveBeenCalled();
    expect(m.removeTodo).not.toHaveBeenCalled();
    expect(m.getWritableUserEmail).not.toHaveBeenCalled();
  });

  it("propagates the cross-email arena email and sheet to every B2 route", async () => {
    const email = "legacy-alumni@example.test";
    const sheetOverride = "legacy-sheet";
    m.requireContext.mockResolvedValue({
      ok: true,
      mode: "arena",
      email,
      sheetOverride,
    });

    const responses = await Promise.all([
      monthGET(request, { params: Promise.resolve({ yyyymm: "2026-10" }) }),
      todosGET(new NextRequest("https://app.example.test/api/todos?all=1") as never),
      todosPOST(new NextRequest("https://app.example.test/api/todos", {
        method: "POST",
        body: JSON.stringify({ contractRef: "contract-1", 제목: "할 일", 예정일자: "2026-10-10" }),
      }) as never),
      todoPATCH(new Request("https://app.example.test/api/todos/todo-1", {
        method: "PATCH",
        body: JSON.stringify({ 완료여부: true }),
      }) as never, { params: Promise.resolve({ id: "todo-1" }) }),
      todoDELETE(request, { params: Promise.resolve({ id: "todo-1" }) }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
    expect(m.loadMonthMeetings).toHaveBeenCalledWith(email, "2026-10", sheetOverride);
    expect(m.listAllTodos).toHaveBeenCalledWith(email, sheetOverride);
    expect(m.createTodo).toHaveBeenCalledWith(
      email,
      expect.objectContaining({ 제목: "할 일", 예정일자: "2026-10-10" }),
      { operationId: undefined, spreadsheetIdOverride: sheetOverride },
    );
    expect(m.patchTodo).toHaveBeenCalledWith(
      email,
      "todo-1",
      { 완료여부: true },
      sheetOverride,
    );
    expect(m.removeTodo).toHaveBeenCalledWith(email, "todo-1", sheetOverride);
    expect(m.getCurrentUserEmail).not.toHaveBeenCalled();
    expect(m.getWritableUserEmail).toHaveBeenCalledTimes(3);
  });

  it("blocks every todo mutation when the writable gate disagrees with context", async () => {
    m.requireContext.mockResolvedValue({
      ok: true,
      mode: "assigned",
      email: "student@example.test",
    });
    m.getWritableUserEmail.mockResolvedValue("foreign@example.test");

    const responses = await Promise.all([
      todosPOST(new NextRequest("https://app.example.test/api/todos", {
        method: "POST",
        body: JSON.stringify({ contractRef: "contract-1", 제목: "할 일", 예정일자: "2026-10-10" }),
      }) as never),
      todoPATCH(new Request("https://app.example.test/api/todos/todo-1", {
        method: "PATCH",
        body: JSON.stringify({ 완료여부: true }),
      }) as never, { params: Promise.resolve({ id: "todo-1" }) }),
      todoDELETE(request, { params: Promise.resolve({ id: "todo-1" }) }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
    for (const response of responses) {
      await expect(response.json()).resolves.toEqual({
        error: "invalid_student_target",
        code: "invalid_student_target",
      });
    }
    expect(m.createTodo).not.toHaveBeenCalled();
    expect(m.patchTodo).not.toHaveBeenCalled();
    expect(m.removeTodo).not.toHaveBeenCalled();
  });

  it.each([
    ["own", "student@example.test"],
    ["assigned", "assigned@example.test"],
  ])("preserves the %s B2 success path", async (mode, email) => {
    m.requireContext.mockResolvedValue({ ok: true, mode, email });

    await monthGET(request, { params: Promise.resolve({ yyyymm: "2026-10" }) });
    await todosGET(new NextRequest("https://app.example.test/api/todos?contractRef=c-1") as never);

    expect(m.loadMonthMeetings).toHaveBeenCalledWith(email, "2026-10", undefined);
    expect(m.listTodos).toHaveBeenCalledWith(email, "c-1", undefined);
  });
});
