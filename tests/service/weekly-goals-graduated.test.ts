/** 수료 후 판정 — 대시보드 진행 줄과 같은 끝 날짜(총회일, 없으면 수료일) 다음 날부터. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/identity", () => ({}));
vi.mock("@/repo/users", () => ({}));
vi.mock("@/repo/trainer-qualification", () => ({}));
vi.mock("@/repo/users-arena", () => ({}));
vi.mock("@/repo/db/client", () => ({}));
vi.mock("@/repo/db/read-daily", () => ({}));
vi.mock("@/repo/db/weekly-goals", () => ({}));

import { isGraduatedOn } from "@/lib/service/weekly-goals";
import { ceremonyISO } from "@/config/cohort-dates";

describe("isGraduatedOn", () => {
  it("총회일이 있는 기수는 총회일까지 수강 중, 다음 날부터 수료 후", () => {
    const start = "2026-09-04";
    const end = ceremonyISO(start, "11기");
    expect(end).not.toBe("");
    expect(isGraduatedOn(start, "11기", "", end)).toBe(false);
    const next = new Date(Date.parse(end) + 86400000).toISOString().slice(0, 10);
    expect(isGraduatedOn(start, "11기", "", next)).toBe(true);
  });
  it("총회일이 없는 기수는 저장된 수료일로 본다", () => {
    expect(isGraduatedOn("2026-03-06", "9기", "2026-05-02", "2026-05-02")).toBe(false);
    expect(isGraduatedOn("2026-03-06", "9기", "2026-05-02", "2026-05-03")).toBe(true);
  });
  it("끝 날짜를 모르면 수강 중으로 본다(PT과제를 잘못 감추지 않는다)", () => {
    expect(isGraduatedOn("2026-03-06", "연습", "", "2030-01-01")).toBe(false);
    expect(isGraduatedOn("2026-03-06", "연습", undefined, "2030-01-01")).toBe(false);
  });
});
