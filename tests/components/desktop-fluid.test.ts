/**
 * Desktop-fluid student shell (desktop-fluid-20260925) — scoped responsive contracts.
 *
 * Production 1920x1080 showed sidebar 224px + PageContainer pc:max-w-6xl (972px):
 * ~700px of horizontal space wasted, document height 1245px of vertical scroll.
 * Fix: student .desktop-shell >=1024px fills the sidebar remainder; cards
 * rearrange into balanced columns. Mobile/tablet (<1024px) render exactly as
 * before, admin/trainer/auth shells keep their caps.
 *
 * This file pins:
 *  ① PageContainer "fluid" variant — pc cap lifted, tablet/mobile unchanged,
 *     narrow/wide/xwide untouched (admin/trainer caps preserved).
 *  ② TopHeader stays shared-safe — still width="wide" in code (admin keeps its
 *     cap); student fluidity comes from the .desktop-shell CSS scope only.
 *  ③ globals.css fluid block stays scoped — every rule under .desktop-shell at
 *     >=1024px, targeted inner caps only (header/banner/week-nav/weeklygoal),
 *     no global max-w reset, no phone prefixes, no shell backdrop/transform.
 *  ④ All six student tabs use the full available width (fluid containers,
 *     stray pc:max-w-6xl caps removed, payment min1440 special superseded).
 *  ⑤ Desktop arrangements — dashboard 1600 3-col (DOM order kept), DB/contact
 *     1440 workspaces (chooser/date→channel→input order kept, natural scroll),
 *     schedule/calendar/payment multi-column layouts retained.
 *  ⑥ Bottom spacers — desktop pb scoped (pc:), mobile safe-area intact,
 *     TabBar still pc:hidden.
 *  ⑦ Render behavior — fluid container really renders children unclipped
 *     (no overflow-hidden / fixed-height squeezing).
 *  ⑦ Chart hooks — explicit svg hooks, viewBox + meet intact, mobile svg
 *     untouched, desktop-only max-height caps in the shell scope.
 *  ⑧ Shell reserves — no desktop tabbar reserve (layout + weekly-goal),
 *     mobile safe space intact.
 */
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const classAttrs = (src: string) =>
  [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1] ?? "");

import PageContainer from "@/components/PageContainer";

const render = (width: "narrow" | "wide" | "xwide" | "fluid", child = "본문") =>
  renderToStaticMarkup(React.createElement(PageContainer, { width, children: child }));

describe("① PageContainer fluid variant", () => {
  it("fluid lifts the pc cap but keeps the tablet cap (mobile/tablet unchanged)", () => {
    const html = render("fluid");
    expect(html).toContain("pc:max-w-none");
    expect(html).toContain("md:max-w-2xl");
    expect(html).toContain("pc:px-6");
    expect(html).not.toContain("wide:px-8");
    expect(html).not.toContain("pc:max-w-6xl");
  });

  it("narrow/wide/xwide keep their caps (admin/trainer/auth unaffected)", () => {
    expect(render("wide")).toContain("pc:max-w-6xl");
    expect(render("narrow")).toContain("pc:max-w-2xl");
    expect(render("xwide")).toContain("pc:max-w-[120rem]");
    for (const w of ["narrow", "wide", "xwide"] as const) {
      expect(render(w)).not.toContain("pc:max-w-none");
    }
  });

  it("renders children without clipping or fixed-height squeezing", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageContainer, {
        width: "fluid",
        children: React.createElement("button", { type: "button" }, "저장하기"),
      }),
    );
    expect(html).toContain("저장하기");
    expect(html).not.toContain("overflow-hidden");
    expect(html).not.toMatch(/max-h-\[500px\]/);
  });
});

describe("② TopHeader stays shared-safe", () => {
  it("keeps width=wide in code — admin/trainer shells keep their caps", () => {
    const src = read("components/TopHeader.tsx");
    const containers = [...src.matchAll(/<PageContainer\s+width="(\w+)"/g)].map(
      (m) => m[1],
    );
    expect(containers.length).toBeGreaterThan(0);
    for (const w of containers) expect(w).toBe("wide");
  });

  it("exposes the page-banner hook the shell scope aligns", () => {
    expect(read("components/TopHeader.tsx")).toContain("page-banner");
  });
});

describe("③ globals.css fluid block stays scoped", () => {
  const css = read("app/globals.css");
  // Same convention as the glass test: slice starts mid-header-comment, so
  // first drop through its closer, then strip the rest — prose may name
  // tokens/prefixes; only rules count.
  const block = css.slice(css.indexOf("Desktop-fluid student shell"));
  const rules = block
    .replace(/^[\s\S]*?\*\//, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("lives inside min-width:1024px under .desktop-shell only", () => {
    expect(block).toContain("@media (min-width: 1024px)");
    for (const sel of [
      ".desktop-shell .desktop-glass-header > div",
      ".desktop-shell .page-banner > div",
      ".desktop-shell .weeklygoal-main > div",
      ".desktop-shell .week-nav-row",
    ]) {
      expect(rules).toContain(sel);
    }
    const selectors = rules
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.endsWith("{") && !l.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors) expect(sel.startsWith(".desktop-shell")).toBe(true);
  });

  it("has no global max-w reset, phone prefixes, or shell paint traps", () => {
    expect(rules).not.toMatch(/\.desktop-shell\s*\{[^}]*max-width/);
    expect(rules).not.toMatch(/[\s("'](sm|md|lg|xl):/);
    expect(rules).not.toMatch(/\.desktop-shell\s*\{[^}]*backdrop-filter/);
    expect(rules).not.toMatch(/\.desktop-shell\s*\{[^}]*transform/);
    expect(rules).not.toContain("overflow:hidden");
    expect(rules).not.toContain("overflow: hidden");
  });
});

describe("④ all six student tabs use the full available width", () => {
  const pages = [
    "app/(app)/dashboard/page.tsx",
    "app/(app)/db/page.tsx",
    "app/(app)/contact/page.tsx",
    "app/(app)/schedule/page.tsx",
    "app/(app)/calendar/page.tsx",
    "app/(app)/payment/page.tsx",
  ];

  it.each(pages)("%s renders a fluid container", (rel) => {
    expect(read(rel)).toContain('<PageContainer width="fluid"');
  });

  it("schedule sticky header container is fluid too", () => {
    const src = read("app/(app)/schedule/page.tsx");
    expect(src).toContain('<PageContainer width="fluid">');
    expect(src).not.toContain("pc:max-w-6xl");
  });

  it("calendar month nav stray cap is gone (uniform pc:px-6 gutter)", () => {
    // className attributes only — prose comments may name the old cap.
    const attrs = classAttrs(read("app/(app)/calendar/page.tsx")).join("\n");
    expect(attrs).not.toContain("pc:max-w-6xl");
    expect(attrs).toContain("pc:px-6");
  });

  it("payment min1440 special is superseded by fluid", () => {
    const attrs = classAttrs(read("app/(app)/payment/page.tsx")).join("\n");
    expect(attrs).not.toContain("min-[1440px]:max-w-none");
  });

  it("weekly-goal student cap+gutter come from the shell scope only (trainer keeps original)", () => {
    const src = read("components/weekly-goals/WeeklyGoalPage.tsx");
    // Shared Content serves student AND trainer: unconditional pc: cap/gutter
    // classes leaked into the trainer assist view (no .desktop-shell ancestor).
    // Assert their absence on class attributes — prose comments may name them.
    const attrs = classAttrs(src).join("\n");
    expect(attrs).not.toContain("pc:max-w-none");
    expect(attrs).not.toContain("pc:px-6");
    // Exactly one rendered .desktop-shell (student branch) — trainer assist
    // view stays single-column with no sidebar. (Code comments may name it.)
    expect(src.match(/"desktop-shell/g)).toHaveLength(1);
    const css = read("app/globals.css");
    expect(css).toContain(".desktop-shell .weeklygoal-main > div");
    expect(css).toContain(".desktop-shell .weeklygoal-main {");
  });
});

describe("⑤ desktop arrangements keep order, workflow, and natural scroll", () => {
  it("dashboard: 1600 3-col via contents (DOM order 생산성→목표→퍼널 kept)", () => {
    const src = read("app/(app)/dashboard/page.tsx");
    expect(src).toContain("min-[1600px]:grid-cols-3");
    expect(src).toContain("min-[1600px]:contents");
    const body = src.slice(src.indexOf("<ProductivityIndicators"));
    expect(body.indexOf("<ProductivityIndicators")).toBeLessThan(
      body.indexOf("<WeeklyGoalSummary"),
    );
    expect(body.indexOf("<WeeklyGoalSummary")).toBeLessThan(
      body.indexOf("<FunnelChart"),
    );
    // Charts side by side below, legibility untouched (no height flattening).
    expect(src).toContain("<WeeklyDualChart");
    expect(src).toContain("<ChannelPerformance");
    expect(src).not.toMatch(/h-\[\d+px\]/);
    // No stretch empty height — cards keep natural heights (goal grows with
    // long PT tasks); chart balance comes from the shell-scope max-height.
    expect(src).toContain("pc:items-start");
    expect(src).not.toContain("pc:items-stretch");
    expect(src).not.toContain("pc:flex-1");
    // Short content must not force viewport height (shell reserves nothing).
    expect(src).toContain("pc:min-h-0");
  });

  it("DB: channel chooser stays first, form/list grouped, summary aside", () => {
    const src = read("app/(app)/db/page.tsx");
    expect(src).toContain(
      "min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    );
    const chooser = src.indexOf('aria-label="입력할 채널"');
    const workspace = src.indexOf("<DbChannelWorkspace");
    const overall = src.indexOf("<OverallCard");
    expect(chooser).toBeGreaterThan(-1);
    expect(chooser).toBeLessThan(workspace);
    expect(workspace).toBeLessThan(overall);
    // Desktop 2-col applies only after a channel is picked — no empty left /
    // half-width Overall when activeCh is null.
    expect(src).toMatch(/activeCh !== null \?/);
    // Visited forms stay mounted (no extra clicks), no fixed-height boxes.
    expect(src).toContain("hidden={channel !== activeCh}");
    expect(src).not.toMatch(/max-h-\[500px\]/);
    expect(src).not.toContain("overflow-hidden");
  });

  it("contact: date→channel→input before the slot list, same DOM order", () => {
    const src = read("app/(app)/contact/page.tsx");
    expect(src).toContain(
      "min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    );
    const panel = src.indexOf("<ChannelTabsAndPanel");
    const list = src.indexOf("<MeetingSlotList");
    expect(panel).toBeGreaterThan(-1);
    expect(panel).toBeLessThan(list);
    expect(src).not.toMatch(/max-h-\[500px\]/);
  });

  it("schedule/calendar/payment keep their proven multi-column layouts", () => {
    expect(read("app/(app)/schedule/_components/WeekBody.tsx")).toContain(
      "pc:grid-cols-2",
    );
    const cal = read("app/(app)/calendar/page.tsx");
    expect(cal).toContain("pc:grid-cols-7");
    expect(cal).toContain("pc:col-span-5");
    const pay = read("app/(app)/payment/page.tsx");
    expect(pay).toContain("min-[1440px]:grid-cols-2");
    // Mobile payment accordion branch is intact.
    expect(pay).toContain("모바일(<pc): 기존 아코디언");
  });

  it("week-nav rows keep the tablet grouping, fluid on desktop shell", () => {
    for (const rel of [
      "app/(app)/contact/_components/WeekHeader.tsx",
      "app/(app)/schedule/_components/WeekHeader.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain("week-nav-row");
      expect(src).toContain("2xl:max-w-xl");
    }
  });
});

describe("⑥ bottom spacers — desktop scoped, mobile safe-area intact", () => {
  it("TabBar stays hidden on desktop (the bar the spacers compensate)", () => {
    expect(read("components/TabBar.tsx")).toContain("pc:hidden");
  });

  it.each([
    "app/(app)/dashboard/page.tsx",
    "app/(app)/db/page.tsx",
    "app/(app)/schedule/_components/WeekBody.tsx",
    "app/(app)/calendar/page.tsx",
    "app/(app)/payment/page.tsx",
  ])("%s keeps its mobile spacer with a pc: override", (rel) => {
    const attrs = classAttrs(read(rel)).join("\n");
    expect(attrs).toMatch(/pb-20|pb-\[80px\]/);
    expect(attrs).toContain("pc:pb-6");
  });
});

describe("⑦ chart hooks — desktop-only balance, mobile SVG unchanged", () => {
  const hooks: Array<[string, string, string]> = [
    ["components/dashboard/FunnelChart.tsx", "funnel-svg", "0 0 358 260"],
    ["components/dashboard/WeeklyDualChart.tsx", "weekly-trend-svg", "0 0 358 200"],
    ["components/dashboard/ChannelPerformance.tsx", "channel-donut-svg", "0 0 170 160"],
  ];

  it.each(hooks)("%s exposes its hook with viewBox + meet intact", (rel, hook, vb) => {
    const src = read(rel as string);
    expect(src).toContain(`viewBox="${vb}"`);
    expect(src).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(src).toContain(`${hook} w-full`);
  });

  it("mobile SVG is untouched: no pc: sizing or clipping on the svg elements", () => {
    for (const [rel] of hooks) {
      const svgAttrs = [...read(rel).matchAll(/<svg[^>]*className="([^"]*)"/g)].map(
        (m) => m[1] ?? "",
      );
      expect(svgAttrs.length).toBeGreaterThan(0);
      for (const cls of svgAttrs) {
        expect(cls).not.toMatch(/pc:(max-h|h|min-h)-/);
        expect(cls).not.toContain("overflow-hidden");
      }
    }
  });

  it("desktop caps live in the .desktop-shell >=1024 scope (centered, not clipped)", () => {
    const block = read("app/globals.css").slice(
      read("app/globals.css").indexOf("Desktop-fluid student shell"),
    );
    for (const [hook, cap] of [
      [".desktop-shell .funnel-svg", "max-height: 220px"],
      [".desktop-shell .weekly-trend-svg", "max-height: 260px"],
      [".desktop-shell .channel-donut-svg", "max-height: 160px"],
    ] as Array<[string, string]>) {
      expect(block).toContain(hook);
      expect(block).toContain(cap);
    }
    expect(block).not.toContain("overflow:hidden");
    expect(block).not.toContain("overflow: hidden");
  });
});

describe("⑧ shell reserves — desktop keeps no tabbar space, mobile intact", () => {
  it("layout reserves nothing on desktop; mobile keeps the tabbar var", () => {
    const src = read("app/(app)/layout.tsx");
    expect(src).not.toContain("--app-tabbar-height:2.5rem");
    expect(src).not.toContain("paddingBottom");
    expect(src).toContain("app-shell-main");
    const css = read("app/globals.css");
    expect(css).toContain(".app-shell-main {");
    expect(css).toContain("padding-bottom: var(--app-tabbar-height)");
    expect(css).toContain(".desktop-shell .app-shell-main");
  });

  it("weekly-goal viewport floor changes only within the student desktop shell", () => {
    const attrs = classAttrs(
      read("components/weekly-goals/WeeklyGoalPage.tsx"),
    ).join("\n");
    expect(attrs).toContain("min-h-dvh");
    expect(attrs).not.toContain("pc:min-h-0");
    expect(attrs).not.toContain("pc:pb-6");
    const studentRule = [...read("app/globals.css").matchAll(/\.desktop-shell \.weeklygoal-main \{([^}]+)\}/g)].map(match => match[1]).join("\n");
    expect(studentRule).toContain("min-height: 0");
    expect(studentRule).toContain("padding-bottom: 1.5rem");
  });
});
