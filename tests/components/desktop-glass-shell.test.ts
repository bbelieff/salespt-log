/**
 * Desktop glass polish (desktop-glass-polish-existing-20260925) — DOM + scope tests.
 *
 * Source-level desktop-nav.test.ts already pins the CSS-split contract
 * (hidden/pc:flex, NAV_STEPS SSOT, guarded routing, no width branching).
 * Here we render the REAL components (jsdom) and assert behavior:
 *   ① sidebar root carries the desktop-nav glass scope class
 *   ② Drive resource: linked/legacy → external folder link; missing/error →
 *      guarded /payment#drive-link (existing DriveLinkBar connect UI)
 *   ③ folder id is URL-encoded; admin item keeps the useMe-only guard
 *   ④ WeeklyGoalPage STUDENT mode reuses the same desktop shell/sidebar,
 *      trainer assist view stays single-column, no mobile TabBar is added
 *   ⑤ globals.css glass stays scoped: >=1024px + inside .desktop-shell,
 *      @supports fallback + reduced-transparency, no global paint rules
 */
 // @vitest-environment jsdom
import * as React from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("React", React);

const state = vi.hoisted(() => ({
  pathname: "/dashboard",
  me: {} as Record<string, unknown>,
  pushes: [] as string[],
}));

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => React.createElement("a", props),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({
    push: (href: string) => {
      state.pushes.push(href);
    },
    replace: (href: string) => {
      state.pushes.push(href);
    },
    prefetch: () => {},
  }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { canStudent: false, canTrainer: false } }),
}));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: state.me }) }));
vi.mock("@/query/announcements-hook", () => ({
  useAnnouncements: () => ({ data: null }),
}));
vi.mock("@/config", () => ({ guideUrl: () => "" }));
vi.mock("@/analytics", () => ({
  identifyUser: vi.fn(),
  resetUser: vi.fn(),
  markInternal: vi.fn(),
  clearInternal: vi.fn(),
}));
vi.mock("@/components/announcements/AnnouncementsGate", () => ({
  ANNOUNCEMENTS_SEEN_EVENT: "synthetic-news",
  hasUnseenUpdates: () => false,
}));
vi.mock("@/components/weekly-goals/client", () => ({
  useGoalView: () => ({ isPending: true }),
  goalAccessDenied: () => false,
}));
vi.mock("@/components/weekly-goals/WeeklyGoalEditor", () => ({
  default: () => null,
}));

import DesktopNav from "@/components/desktop/DesktopNav";
import WeeklyGoalPage from "@/components/weekly-goals/WeeklyGoalPage";
import { WORK_MANUAL_URL } from "@/config/links";

const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);

beforeEach(() => {
  state.pathname = "/dashboard";
  state.me = {};
  state.pushes = [];
});
afterEach(() => {
  act(() => root.unmount());
  host.innerHTML = "";
  root = createRoot(host);
});

function render(el: React.ReactElement) {
  act(() => root.render(el));
}

function driveAnchor(): Element | null {
  const all = Array.from(host.querySelectorAll('nav[aria-label="주 메뉴"] a'));
  return all.find((a) => (a.textContent ?? "").startsWith("구글드라이브")) ?? null;
}

describe("① sidebar root — glass scope class, CSS-split display", () => {
  it("carries desktop-nav and stays hidden below pc", () => {
    state.me = { feedbackFolderId: "abc", driveLinkStatus: "ok" };
    render(createElement(DesktopNav));
    const nav = host.querySelector('nav[aria-label="주 메뉴"]');
    expect(nav).not.toBeNull();
    const tokens = (nav!.getAttribute("class") ?? "").split(/\s+/);
    expect(tokens).toContain("desktop-nav");
    expect(tokens).toContain("hidden");
    expect(tokens).toContain("pc:flex");
  });
});

describe("② Drive resource — linked vs fallback", () => {
  it("status ok + folder → external Drive link, no connect badge", () => {
    state.me = { feedbackFolderId: "abc123", driveLinkStatus: "ok" };
    render(createElement(DesktopNav));
    const a = driveAnchor()!;
    expect(a.getAttribute("href")).toBe("https://drive.google.com/drive/folders/abc123");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(host.textContent).not.toContain("연결 필요");
  });

  it("legacy unset status + folder → still linked (good links never break)", () => {
    state.me = { feedbackFolderId: "legacy-folder" };
    render(createElement(DesktopNav));
    const a = driveAnchor()!;
    expect(a.getAttribute("href")).toBe("https://drive.google.com/drive/folders/legacy-folder");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(host.textContent).not.toContain("연결 필요");
  });

  it("explicit error status → guarded /payment#drive-link fallback, click pushes it", () => {
    state.me = { feedbackFolderId: "stale-folder", driveLinkStatus: "error" };
    render(createElement(DesktopNav));
    const a = driveAnchor()!;
    expect(a.getAttribute("href")).toBe("/payment#drive-link");
    expect(a.getAttribute("aria-label")).toBe("구글드라이브 — 연결 필요");
    expect(a.textContent).toContain("연결 필요");
    act(() => {
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    // SideLink goes through the guarded router, not a raw anchor jump.
    expect(state.pushes).toEqual(["/payment#drive-link"]);
  });

  it("missing folder → same /payment#drive-link fallback", () => {
    state.me = { driveLinkStatus: "" };
    render(createElement(DesktopNav));
    const a = driveAnchor()!;
    expect(a.getAttribute("href")).toBe("/payment#drive-link");
    expect(a.textContent).toContain("연결 필요");
  });

  it("folder id is URL-encoded in the external link", () => {
    state.me = { feedbackFolderId: "a/b?c=d e", driveLinkStatus: "ok" };
    render(createElement(DesktopNav));
    const a = driveAnchor()!;
    expect(a.getAttribute("href")).toBe(
      `https://drive.google.com/drive/folders/${encodeURIComponent("a/b?c=d e")}`,
    );
  });
});

describe("③ admin item + payment sub-tab routing preserved", () => {
  it("shows 관리자 only for useMe-provided admin signals", () => {
    state.me = {};
    render(createElement(DesktopNav));
    expect(host.querySelector('a[aria-label="관리자"]')).toBeNull();

    state.me = { isAdmin: true };
    render(createElement(DesktopNav));
    expect(host.querySelector('a[aria-label="관리자"]')!.getAttribute("href")).toBe("/admin");

    state.me = { sessionRole: "admin" };
    render(createElement(DesktopNav));
    expect(host.querySelector('a[aria-label="관리자"]')).not.toBeNull();
  });

  it("keeps manual/news routing: news is internal, manual is the only new tab", () => {
    state.pathname = "/payment/news";
    state.me = { feedbackFolderId: "abc", driveLinkStatus: "ok" };
    render(createElement(DesktopNav));
    const news = host.querySelector('a[href="/payment/news"]')!;
    expect(news.getAttribute("target")).toBeNull();
    expect(news.getAttribute("aria-current")).toBe("page");
    const manual = host.querySelector(`a[href="${WORK_MANUAL_URL}"]`)!;
    expect(manual.getAttribute("target")).toBe("_blank");
    expect(manual.getAttribute("aria-label")).toBe("업무매뉴얼 (새 탭에서 열림)");
  });
});

describe("④ WeeklyGoalPage — student shell reuses DesktopNav, trainer view does not", () => {
  const studentProps = { student: "", date: "", week: "", trainer: false };

  it("STUDENT mode renders the same sidebar shell and no mobile TabBar", () => {
    state.me = { feedbackFolderId: "abc", driveLinkStatus: "ok" };
    render(createElement(WeeklyGoalPage, studentProps));
    expect(host.querySelector(".desktop-shell")).not.toBeNull();
    expect(host.querySelector('nav[aria-label="주 메뉴"]')).not.toBeNull();
    expect(host.querySelector('nav[aria-label="업무 단계 내비게이션"]')).toBeNull();
    expect(host.querySelector("header")).not.toBeNull();
    expect(host.querySelector(".weeklygoal-main")).not.toBeNull();
    expect(host.textContent).toContain("목표를 불러오는 중");
  });

  it("trainer assist view stays single-column with no sidebar", () => {
    render(
      createElement(WeeklyGoalPage, { ...studentProps, student: "a@b.c", trainer: true }),
    );
    expect(host.querySelector(".desktop-shell")).toBeNull();
    expect(host.querySelector('nav[aria-label="주 메뉴"]')).toBeNull();
    expect(host.querySelector("header")).not.toBeNull();
  });

  it("sidebar moves go through the wrapping DirtyProvider (no parallel provider)", () => {
    // Functional proof: the student shell renders sidebar + content inside one
    // live provider, so a sidebar click is guarded-navigated, not a raw jump.
    state.me = {};
    render(createElement(WeeklyGoalPage, studentProps));
    const nav = host.querySelector('nav[aria-label="주 메뉴"]')!;
    const fallback = Array.from(nav.querySelectorAll("a")).find((a) =>
      (a.textContent ?? "").startsWith("구글드라이브"),
    )!;
    expect(fallback.getAttribute("href")).toBe("/payment#drive-link");
    act(() => {
      fallback.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(state.pushes).toEqual(["/payment#drive-link"]);
    // Structural proof: trainer/student branches each wrap in exactly one
    // provider — never nested, never a second parallel context.
    const src = readFileSync("components/weekly-goals/WeeklyGoalPage.tsx", "utf8");
    const tags = src.match(/<\/?DirtyProvider>/g) ?? [];
    let depth = 0;
    for (const tag of tags) {
      depth += tag === "<DirtyProvider>" ? 1 : -1;
      expect(depth).toBeLessThanOrEqual(1);
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    expect(tags.filter((t) => t === "<DirtyProvider>")).toHaveLength(2);
  });
});

describe("⑤ glass CSS stays scoped — desktop shell only, with fallback", () => {
  const css = readFileSync("app/globals.css", "utf8");
  // Strip comments — prose may name tokens/prefixes; only rules count.
  // (The slice starts mid-header-comment, so first drop through its closer.)
  const glass = css
    .slice(css.indexOf("Desktop glass shell"))
    .replace(/^[\s\S]*?\*\//, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("paints only inside .desktop-shell at >=1024px", () => {
    expect(glass).toContain("@media (min-width: 1024px)");
    expect(glass).toContain(".desktop-shell .desktop-nav");
    expect(glass).toContain(".desktop-shell .desktop-glass-header");
    expect(glass).toContain("width: 224px");
    // Every rule selector in the block is scoped under .desktop-shell.
    const selectors = glass
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith("{") && !line.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors) expect(sel.startsWith(".desktop-shell")).toBe(true);
    // No phone-prefix utilities in the new rules (sm/md/lg/xl are phone widths).
    expect(glass).not.toMatch(/[\s("'](sm|md|lg|xl):/);
  });

  it("uses @supports fallback and reduced-transparency flat paint", () => {
    expect(glass).toContain("@supports");
    expect(glass).toContain("rgb(255 255 255 / 55%)");
    expect(glass).toContain("blur(24px) saturate(150%)");
    expect(glass).toContain("prefers-reduced-transparency");
  });

  it("never force-paints generic surfaces or traps modals", () => {
    expect(glass).not.toMatch(/\.bg-white\s*\{/);
    // Bare `main` element selector (not `.weeklygoal-main` etc.).
    expect(glass).not.toMatch(/(^|[\s,}])main\s*\{/m);
    // No backdrop-filter/transform on the shell itself or content — modals stay safe.
    expect(glass).not.toMatch(/\.desktop-shell\s*\{[^}]*backdrop-filter/);
    expect(glass).not.toMatch(/\.desktop-shell\s*\{[^}]*transform/);
    expect(glass).not.toMatch(/\.weeklygoal-main\s*\{[^}]*backdrop-filter/);
  });

  it("DriveLinkBar exposes the #drive-link anchor with sticky offset", () => {
    const bar = readFileSync("app/(app)/payment/_components/DriveLinkBar.tsx", "utf8");
    expect(bar).toContain('id="drive-link"');
    expect(bar).toContain("scroll-mt-");
  });
});
