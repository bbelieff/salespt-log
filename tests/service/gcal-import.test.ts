/** gcal-import 실행부 — 연결·저장 방식 게이트, 같은 행 id, 1분 제한. 저장·구글 호출은 가짜로 바꿔 끼운다. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  conn: { connected: true, refreshToken: "rt", settings: { calendarId: "primary" } },
  events: [] as unknown[],
  todos: [] as unknown[],
  db: true,
  created: [] as { input: Record<string, unknown>; opts: Record<string, unknown> }[],
  conflict: false,
}));

vi.mock("@/repo/gcal-token", () => ({ getGcalConnection: async () => h.conn }));
vi.mock("@/repo/gcal-client", () => ({ listEventsInRange: async () => h.events }));
vi.mock("@/repo/users", () => ({ findUserByEmail: async () => ({ cohort: "10", cohortLabel: "10" }) }));
vi.mock("@/service/daily-source", () => ({ usesDbStorage: () => h.db, sourceCohort: () => "10" }));
vi.mock("@/service/todos", () => {
  class TodoOperationConflict extends Error {}
  return {
    TodoOperationConflict,
    listAllTodos: async () => h.todos,
    patchTodo: vi.fn(async () => {}),
    removeTodo: vi.fn(async () => {}),
    createTodo: vi.fn(async (_e: string, input: Record<string, unknown>, opts: Record<string, unknown>) => {
      if (h.conflict) throw new TodoOperationConflict("dup");
      h.created.push({ input, opts });
      return input;
    }),
  };
});

import { importGcalEvents, resetGcalImportThrottle } from "@/service/gcal-import";

const ev = { id: "e1", status: "confirmed", updated: "u1", summary: "가족 모임", location: "", description: "", start: { date: "2026-11-30" }, salesptId: "" };

beforeEach(() => {
  resetGcalImportThrottle();
  h.conn = { connected: true, refreshToken: "rt", settings: { calendarId: "primary" } };
  h.events = [ev];
  h.todos = [];
  h.db = true;
  h.created = [];
  h.conflict = false;
});

describe("importGcalEvents", () => {
  it("구글 일정을 일반 일정(분류 기타)으로 만들고 원본 표시를 남긴다", async () => {
    const r = await importGcalEvents("a@test.invalid", new Date("2026-11-21T00:00:00Z"));
    expect(r).toMatchObject({ ran: true, created: 1 });
    expect(h.created[0]?.input).toMatchObject({ type: "일반", 분류: "기타", 제목: "가족 모임", 예정일자: "2026-11-30", gcalSource: { eventId: "e1", updated: "u1" } });
    expect(String(h.created[0]?.opts.operationId)).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("같은 사용자·같은 일정은 늘 같은 행 id", async () => {
    await importGcalEvents("a@test.invalid", new Date("2026-11-21T00:00:00Z"));
    resetGcalImportThrottle();
    await importGcalEvents("a@test.invalid", new Date("2026-11-21T00:05:00Z"));
    expect(h.created).toHaveLength(2);
    expect(h.created[0]?.opts.operationId).toBe(h.created[1]?.opts.operationId);
  });
  it("이미 가져왔거나 앱에서 지운 일정(같은 행 id 충돌)은 조용히 건너뜀", async () => {
    h.conflict = true;
    const r = await importGcalEvents("a@test.invalid");
    expect(r).toMatchObject({ ran: true, created: 0 });
  });
  it("연결 안 됨·시트 저장 기수는 아무것도 안 함", async () => {
    h.conn = { connected: false, refreshToken: "", settings: { calendarId: "primary" } };
    expect(await importGcalEvents("a@test.invalid")).toMatchObject({ ran: false, reason: "not_connected" });
    resetGcalImportThrottle();
    h.conn = { connected: true, refreshToken: "rt", settings: { calendarId: "primary" } };
    h.db = false;
    expect(await importGcalEvents("a@test.invalid")).toMatchObject({ ran: false, reason: "sheet_storage" });
    expect(h.created).toHaveLength(0);
  });
  it("1분 안에 다시 부르면 건너뜀", async () => {
    const t0 = new Date("2026-11-21T00:00:00Z");
    await importGcalEvents("a@test.invalid", t0);
    const r = await importGcalEvents("a@test.invalid", new Date(t0.getTime() + 30_000));
    expect(r).toMatchObject({ ran: false, reason: "throttled" });
  });
});
