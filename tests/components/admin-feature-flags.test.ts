// @vitest-environment jsdom
/**
 * 관리자 기능 스위치(admin-phase1, 2026-11-16) — 잘 안 쓰는 기능의 «진입점» 만 숨긴다.
 *  ① 기본값은 셋 다 꺼짐.
 *  ② 유보: 「유보 처리」 버튼은 스위치가 켜져야 보인다. 유보 수강생 목록·복귀는 늘 보인다(갇히지 않게).
 *  ③ 기수 보관: 「보관 처리」는 스위치가 켜져야. 보관한 기수 목록·활성화는 늘 보인다.
 *  ④ 실패분 재시도: 실패가 있을 때만.
 *  ⑤ 공유왕: 아레나 화면의 링크만 스위치 뒤로(주소는 그대로).
 *  ⑥ 「동기화」는 수강생 관리 머리줄에서 빠져 설정 > 진단에 있다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const flags = vi.hoisted(() => ({ reserve: false, cohortArchive: false, shareScores: false }));
vi.mock("@/config/admin-features", () => ({ ADMIN_FEATURES: flags }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(), clear: vi.fn() }) }));
vi.mock("@/components/ui/LoadingProvider", () => ({ useGlobalLoading: () => ({ show: vi.fn(), hide: vi.fn() }) }));
// 이 시험이 보는 것은 머리줄 버튼과 유보·보관 구역뿐 — 무거운 자식은 자리만 둔다.
vi.mock("@/components/auth/CohortCategoryBoxes", () => ({ default: () => null }));
vi.mock("@/components/auth/UnifiedPrepCard", () => ({ default: () => null }));
vi.mock("@/components/auth/BulkReserveButton", () => ({ default: () => h("button", { "data-bulk-reserve": "" }, "유보 처리") }));
vi.mock("@/components/auth/CohortCreateModal", () => ({ default: () => null }));
vi.mock("@/components/auth/ArenaCreateModal", () => ({ default: () => null }));

import AdminUserPicker from "@/components/auth/AdminUserPicker";
import CohortMgmtPanel from "@/components/auth/CohortMgmtPanel";
import CohortPendingRetryButton from "@/components/auth/CohortPendingRetryButton";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

let root: Root | null = null;
let host: HTMLDivElement | null = null;
function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}
beforeEach(() => Object.assign(flags, { reserve: false, cohortArchive: false, shareScores: false }));
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
const buttons = (el: HTMLElement) => [...el.querySelectorAll("button")].map((b) => b.textContent?.trim());

const trainee = (email: string, name: string, cohort: string) => ({
  email, name, cohort, spreadsheetId: "", role: "trainee" as const, status: "active" as const, assignedTrainer: "",
});
const picker = (reserved: ReturnType<typeof trainee>[], viewOnly = false) =>
  h(AdminUserPicker, {
    users: [trainee("a@example.test", "가상일", "11")] as never,
    reservedUsers: reserved as never,
    activeTrainers: [],
    sessionEmail: "admin@example.test",
    viewOnly,
  });

describe("기본값", () => {
  it("유보·기수 보관·공유왕은 꺼져 있다", async () => {
    const real = await vi.importActual<typeof import("@/config/admin-features")>("@/config/admin-features");
    expect(real.ADMIN_FEATURES).toEqual({ reserve: false, cohortArchive: false, shareScores: false });
  });
});

describe("유보", () => {
  it("스위치가 꺼지면 「유보 처리」 버튼이 없다 — 켜면 보인다", () => {
    expect(mount(picker([])).querySelector("[data-bulk-reserve]")).toBeNull();
    act(() => root?.unmount());
    flags.reserve = true;
    expect(mount(picker([])).querySelector("[data-bulk-reserve]")).not.toBeNull();
    act(() => root?.unmount());
    // 조회 전용(관리부서)은 켜져 있어도 없다.
    expect(mount(picker([], true)).querySelector("[data-bulk-reserve]")).toBeNull();
  });
  it("꺼져 있어도 유보 수강생 목록과 복귀·퇴출은 보인다", () => {
    const el = mount(picker([trainee("r@example.test", "가상유보", "유보")]));
    expect(el.textContent).toContain("유보 수강생 (1명)");
    expect(el.textContent).toContain("가상유보");
    expect(buttons(el)).toContain("복귀");
  });
  it("유보 수강생이 없으면 유보 구역도 없다", () => {
    expect(mount(picker([])).textContent).not.toContain("유보 수강생");
  });
  it("「동기화」는 수강생 관리에 없고 설정 > 진단에 있다", () => {
    expect(read("components/auth/AdminUserPicker.tsx")).not.toContain("MigrateCacheButton />");
    expect(buttons(mount(picker([]))).join(" ")).not.toContain("동기화");
    const settings = read("app/admin/settings/page.tsx");
    expect(settings).toContain("<MigrateCacheButton />");
    expect(settings).toContain('href="/admin/db-parity"');
    expect(settings).toContain("<SystemStatusStrip");
    // 진단은 기본으로 접혀 있다 — defaultOpen 을 주지 않는다.
    expect(settings).toMatch(/<CollapsibleSection title="진단" persistKey="admin-settings:diagnostics">/);
  });
});

describe("기수 보관", () => {
  const cohorts = [
    { label: "11", status: "active" as const, note: "", traineeCount: 3 },
    { label: "7", status: "archived" as const, note: "", traineeCount: 5 },
  ];
  const panel = (list = cohorts, extra: Record<string, unknown> = {}) =>
    h(CohortMgmtPanel, { sessionEmail: "admin@example.test", cohorts: list, ...extra });

  it("꺼지면 「보관 처리」가 없고, 보관한 기수 목록과 활성화는 보인다", () => {
    const el = mount(panel());
    expect(buttons(el)).not.toContain("보관 처리");
    expect(el.querySelector('[aria-label="보관한 기수"]')?.textContent).toContain("7기");
    expect(buttons(el)).toContain("활성화");
  });
  it("꺼져 있고 보관한 기수가 없으면 그 구역 자체가 없다", () => {
    const el = mount(panel(cohorts.slice(0, 1)));
    expect(el.querySelector('[aria-label="보관한 기수"]')).toBeNull();
    expect(el.textContent).toContain("활성 기수 (1)");
  });
  it("켜면 「보관 처리」가 다시 보인다(조회 전용은 제외)", () => {
    flags.cohortArchive = true;
    const el = mount(panel(cohorts.slice(0, 1)));
    expect(buttons(el)).toContain("보관 처리");
    expect(el.querySelector('[aria-label="보관한 기수"]')).not.toBeNull();
    act(() => root?.unmount());
    expect(buttons(mount(panel(cohorts, { viewOnly: true })))).not.toContain("보관 처리");
  });
});

describe("실패분 재시도", () => {
  it("실패가 없으면 버튼이 없고, 있으면 건수와 함께 보인다", () => {
    expect(mount(h(CohortPendingRetryButton, { pendingCount: 0 })).querySelector("button")).toBeNull();
    act(() => root?.unmount());
    expect(mount(h(CohortPendingRetryButton, { pendingCount: 2 })).querySelector("button")?.textContent).toContain("2건 재시도");
  });
});

describe("공유왕", () => {
  it("아레나 화면의 링크는 스위치 뒤에 있고, 화면(주소)은 남아 있다", () => {
    const src = read("app/admin/arena/page.tsx");
    const at = src.indexOf('href="/admin/arena/share-scores"');
    expect(at).toBeGreaterThan(-1);
    const gate = src.lastIndexOf("{ADMIN_FEATURES.shareScores && (", at);
    expect(gate).toBeGreaterThan(-1);
    expect(src.slice(gate, at)).not.toContain(")}");
    expect(src).toContain('href="/admin/arena/scoreboard"');
    expect(fs.existsSync(path.join(process.cwd(), "app/admin/arena/share-scores/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "app/api/admin/share-scores/route.ts"))).toBe(true);
  });
});

describe("서버 라우트는 그대로", () => {
  it("숨긴 기능의 API 가 남아 있다", () => {
    for (const p of ["set-trainee-reserved", "set-cohort-status", "retry-cohort-creates", "migrate-registry-cache"]) {
      expect(fs.existsSync(path.join(process.cwd(), `app/api/admin/${p}/route.ts`)), p).toBe(true);
    }
  });
});
