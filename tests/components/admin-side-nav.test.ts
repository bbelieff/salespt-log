// @vitest-environment jsdom
/**
 * 관리자 PC 왼쪽 메뉴(2026-11-03, admin-side-nav).
 *  ① 지금 화면 메뉴에 aria-current, 승인 대기 숫자 표시(0이면 숨김).
 *  ② 관리부서 계정엔 마스터 전용(팝업관리·트레이너 페이지) 없음.
 *  ③ 캡쳐용 화면(전광판·공유왕)은 메뉴 없음.
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

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(isMaster: boolean, pendingTrainees = 2, pendingTrainers = 0) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(h(AdminSideNav, { sessionEmail: "admin@example.test", isMaster, pendingTrainees, pendingTrainers }));
  });
  return host;
}

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
  });
  it("관리부서 → 마스터 전용 항목 없음", () => {
    path = "/admin";
    const el = render(false);
    const hrefs = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/admin/popup");
    expect(hrefs).not.toContain("/trainer");
    expect(hrefs).toContain("/admin/users");
  });
  it("전광판·공유왕 화면은 메뉴 없음", () => {
    path = "/admin/arena/scoreboard";
    expect(render(true).querySelector("aside")).toBeNull();
    act(() => root?.unmount());
    path = "/admin/arena/share-scores";
    expect(render(true).querySelector("aside")).toBeNull();
  });
});
