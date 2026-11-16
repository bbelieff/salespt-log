// @vitest-environment jsdom
/**
 * 관리자 홈 「오늘 할 일」(admin-phase1, 2026-11-16).
 *  ① 담당 없는 활성 수강생 = 활성 기수의 활성 수강생만(유보·보관 기수·승인 대기·트레이너 제외).
 *  ② 다섯 숫자는 읽기 함수만 부르고, 한 항목이 실패해도 나머지는 나온다(null = 확인 불가).
 *  ③ 화면: 숫자 + 그 화면 링크. 0 = 「없음」, 기수 생성 실패분은 있을 때만.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  pendingTrainees: vi.fn(),
  pendingTrainers: vi.fn(),
  users: vi.fn(),
  archived: vi.fn(),
  cohortPending: vi.fn(),
  newReports: vi.fn(),
}));
vi.mock("@/repo/users", () => ({
  listPendingTrainees: m.pendingTrainees,
  listPendingTrainers: m.pendingTrainers,
  listDistinctUsers: m.users,
  isReservedTrainee: (u: { cohort: string; role: string }) => u.role === "trainee" && u.cohort.trim() === "유보",
}));
vi.mock("@/repo/cohorts", () => ({ getArchivedCohortSet: m.archived }));
vi.mock("@/repo/db/cohort-pending", () => ({ countPendingCohortCreates: m.cohortPending }));
vi.mock("@/service/bug-reports-admin", () => ({ countNewBugReportsForTodo: m.newReports }));

import { countUnassignedActiveTrainees, getAdminTodoCounts } from "@/service/admin-pending";
import AdminTodoList from "@/components/auth/AdminTodoList";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const USERS = [
  { role: "trainee", status: "active", cohort: "11", assignedTrainer: "" }, // ← 센다
  { role: "trainee", status: "active", cohort: "11기", assignedTrainer: " , " }, // ← 빈 값만 있는 배정도 센다
  { role: "trainee", status: "active", cohort: "11", assignedTrainer: "t@example.test" },
  { role: "trainee", status: "pending", cohort: "11", assignedTrainer: "" },
  { role: "trainee", status: "active", cohort: "유보", assignedTrainer: "" },
  { role: "trainee", status: "active", cohort: "7", assignedTrainer: "" }, // 보관 기수
  { role: "trainee", status: "active", cohort: "5", captainOf: "A1-2", assignedTrainer: "" }, // 보관한 아레나 기수의 회장
  { role: "trainer", status: "active", cohort: "T", assignedTrainer: "" },
];
const ARCHIVED = new Set(["7", "A1-2"]);

beforeEach(() => {
  vi.clearAllMocks();
  m.pendingTrainees.mockResolvedValue([{}, {}]);
  m.pendingTrainers.mockResolvedValue([{}]);
  m.users.mockResolvedValue(USERS);
  m.archived.mockResolvedValue(ARCHIVED);
  m.cohortPending.mockResolvedValue(0);
  m.newReports.mockResolvedValue(4);
});

describe("countUnassignedActiveTrainees", () => {
  it("활성 기수의 활성 수강생 중 담당이 없는 사람만", () => {
    expect(countUnassignedActiveTrainees(USERS, ARCHIVED)).toBe(2);
    expect(countUnassignedActiveTrainees(USERS, new Set())).toBe(4);
    expect(countUnassignedActiveTrainees([], ARCHIVED)).toBe(0);
  });
});

describe("getAdminTodoCounts", () => {
  it("다섯 숫자", async () => {
    await expect(getAdminTodoCounts()).resolves.toEqual({
      pendingTrainees: 2, pendingTrainers: 1, unassignedTrainees: 2, cohortCreateFailures: 0, newBugReports: 4,
    });
  });
  it("한 항목이 실패해도 나머지는 나온다", async () => {
    m.users.mockRejectedValue(new Error("x"));
    m.newReports.mockRejectedValue(new Error("x"));
    m.cohortPending.mockResolvedValue(null); // DB 미설정
    await expect(getAdminTodoCounts()).resolves.toEqual({
      pendingTrainees: 2, pendingTrainers: 1, unassignedTrainees: null, cohortCreateFailures: null, newBugReports: null,
    });
  });
});

describe("AdminTodoList", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });
  function render(counts: Parameters<typeof AdminTodoList>[0]["counts"]) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(h(AdminTodoList, { counts })));
    return (key: string) => host!.querySelector<HTMLAnchorElement>(`a[data-todo="${key}"]`);
  }

  it("숫자와 그 화면 링크", () => {
    const row = render({ pendingTrainees: 2, pendingTrainers: 0, unassignedTrainees: 1234, cohortCreateFailures: 3, newBugReports: null });
    expect(row("pendingTrainees")?.getAttribute("href")).toBe("/admin/users");
    expect(row("pendingTrainees")?.textContent).toContain("2명");
    expect(row("pendingTrainers")?.getAttribute("href")).toBe("/admin/trainers");
    expect(row("pendingTrainers")?.textContent).toContain("없음");
    expect(row("unassignedTrainees")?.getAttribute("href")).toBe("/admin/users");
    expect(row("unassignedTrainees")?.textContent).toContain("1,234명");
    expect(row("cohortCreateFailures")?.getAttribute("href")).toBe("/admin/cohorts");
    expect(row("cohortCreateFailures")?.textContent).toContain("3건");
    expect(row("newBugReports")?.getAttribute("href")).toBe("/admin/reports");
    expect(row("newBugReports")?.textContent).toContain("확인 불가");
  });
  it("기수 생성 실패분은 있을 때만 줄이 생긴다", () => {
    expect(render({ pendingTrainees: 0, pendingTrainers: 0, unassignedTrainees: 0, cohortCreateFailures: 0, newBugReports: 0 })("cohortCreateFailures")).toBeNull();
    act(() => root?.unmount());
    expect(render({ pendingTrainees: 0, pendingTrainers: 0, unassignedTrainees: 0, cohortCreateFailures: null, newBugReports: 0 })("cohortCreateFailures")).toBeNull();
    expect(host!.querySelectorAll("a[data-todo]").length).toBe(4);
  });
});
