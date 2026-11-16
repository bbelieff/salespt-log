// @vitest-environment jsdom
/**
 * 관리자 PC 왼쪽 메뉴(2026-11-03, admin-side-nav · 2026-11-16 admin-phase1 다섯 묶음).
 *  ① 지금 화면 메뉴에 aria-current, 승인 대기 숫자 표시(0이면 숨김).
 *  ② 관리부서 계정엔 마스터 전용(알림·설정·트레이너 페이지) 없음.
 *  ③ 캡쳐용 화면(전광판·공유왕)은 메뉴 없음.
 *  ④ 다섯 묶음(운영 현황·사람·과정·알림·설정)과 묶음별 항목 — 폰 메뉴(AdminMenuList)도 같은 목록.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let path = "/admin/users";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/query/push-hooks", () => ({ forgetPushOnThisDevice: vi.fn() }));

import AdminSideNav from "@/components/auth/AdminSideNav";
import AdminMenuList from "@/components/auth/AdminMenuList";
import { ADMIN_NAV_GROUPS, isAdminNavActive, visibleAdminNavGroups } from "@/config/admin-nav";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(node);
  });
  return host;
}
function render(isMaster: boolean, pendingTrainees = 2, pendingTrainers = 0) {
  return mount(h(AdminSideNav, { sessionEmail: "admin@example.test", isMaster, pendingTrainees, pendingTrainers }));
}
const groupsOf = (el: HTMLElement) =>
  [...el.querySelectorAll('[role="group"]')].map((g) => ({
    label: g.getAttribute("aria-label"),
    hrefs: [...g.querySelectorAll("a")].map((a) => a.getAttribute("href")),
  }));

describe("AdminSideNav", () => {
  it("지금 화면 표시 + 승인 대기 숫자", () => {
    path = "/admin/users";
    const el = render(true);
    const cur = el.querySelector('[aria-current="page"]');
    expect(cur?.getAttribute("href")).toBe("/admin/users");
    expect(el.querySelector('[aria-label="승인 대기 2명"]')).not.toBeNull();
    expect(el.querySelectorAll('[aria-label^="승인 대기"]').length).toBe(1);
  });
  it("하위 경로도 그 메뉴로, 홈은 /admin 일 때만", () => {
    path = "/admin/arena";
    const el = render(true);
    expect(el.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("/admin/arena");
    expect(isAdminNavActive("/admin", "/admin/reports")).toBe(false);
    expect(isAdminNavActive("/admin/reports", "/admin/reports")).toBe(true);
    expect(isAdminNavActive("/trainer", "/trainer")).toBe(false);
  });
  it("관리부서 → 마스터 전용 항목 없음", () => {
    path = "/admin";
    const el = render(false);
    const hrefs = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/admin/popup");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/trainer");
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/reports");
    // 보일 항목이 없는 묶음(알림·설정)은 제목도 없다.
    expect(groupsOf(el).map((g) => g.label)).toEqual(["운영 현황", "사람", "과정"]);
  });
  it("전광판·공유왕 화면은 메뉴 없음", () => {
    path = "/admin/arena/scoreboard";
    expect(render(true).querySelector("aside")).toBeNull();
    act(() => root?.unmount());
    path = "/admin/arena/share-scores";
    expect(render(true).querySelector("aside")).toBeNull();
  });
  it("마스터 → 다섯 묶음과 묶음별 항목", () => {
    path = "/admin";
    expect(groupsOf(render(true))).toEqual([
      { label: "운영 현황", hrefs: ["/admin", "/admin/reports"] },
      { label: "사람", hrefs: ["/admin/users", "/admin/trainers", "/trainer"] },
      { label: "과정", hrefs: ["/admin/cohorts", "/admin/arena"] },
      { label: "알림", hrefs: ["/admin/popup"] },
      { label: "설정", hrefs: ["/admin/settings"] },
    ]);
  });
  it("예전 메뉴의 주소는 모두 남아 있고, 숨긴 공유왕은 메뉴에 없다", () => {
    const all = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    for (const href of ["/admin", "/admin/users", "/admin/trainers", "/admin/cohorts", "/admin/arena", "/admin/popup", "/trainer"]) {
      expect(all).toContain(href);
    }
    expect(all).not.toContain("/admin/arena/share-scores");
    expect(new Set(all).size).toBe(all.length);
    expect(visibleAdminNavGroups(false).flatMap((g) => g.items).some((i) => i.masterOnly)).toBe(false);
  });
});

describe("AdminMenuList (폰 메뉴)", () => {
  it("같은 묶음을 쓰되 지금 화면(홈)은 뺀다 · 승인 대기 숫자", () => {
    const el = mount(h(AdminMenuList, { isMaster: true, pendingTrainees: 0, pendingTrainers: 3 }));
    expect(el.querySelector("nav")?.className).toContain("pc:hidden");
    expect(groupsOf(el)).toEqual([
      { label: "운영 현황", hrefs: ["/admin/reports"] },
      { label: "사람", hrefs: ["/admin/users", "/admin/trainers", "/trainer"] },
      { label: "과정", hrefs: ["/admin/cohorts", "/admin/arena"] },
      { label: "알림", hrefs: ["/admin/popup"] },
      { label: "설정", hrefs: ["/admin/settings"] },
    ]);
    expect(el.querySelectorAll('[aria-label^="승인 대기"]').length).toBe(1);
    expect(el.querySelector('[aria-label="승인 대기 3명"]')).not.toBeNull();
  });
  it("관리부서 → 마스터 전용 없음", () => {
    const el = mount(h(AdminMenuList, { isMaster: false }));
    const hrefs = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/admin/reports", "/admin/users", "/admin/trainers", "/admin/cohorts", "/admin/arena"]);
  });
});
