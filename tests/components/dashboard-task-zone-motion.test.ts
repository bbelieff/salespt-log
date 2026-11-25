// @vitest-environment jsdom
/**
 * 할 일 구역의 움직임 두 가지(belie 2026-11-24 추가 지시):
 *  ① 이어지는 전환(View Transitions) — 펼침/접기 · 칩·단계로 좁히기 · 0건으로 접힘. 미지원·동작 줄이기면 즉시.
 *  ② 선택 바탕이 옮겨 가는 칩 — 할 일 구역 급한 정도 칩, 대시보드 기간 칩(PeriodPicker 선택 사항).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardFollowUpsView from "@/components/dashboard/DashboardFollowUpsView";
import PeriodPicker from "@/components/ui/PeriodPicker";
import { followUpTransitionName, NAMED_ROWS } from "@/components/dashboard/useZoneTransition";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const make = (index: number, days: number, over: Partial<FollowUpItem> = {}): FollowUpItem => ({
  key: `stalled:${index}:1`, kind: "overdue", step: index % 2 ? "2" : "4", group: days >= 7 ? "long-overdue" : days ? "overdue" : "today",
  title: `샘플 업체${index}`, company: `샘플 업체${index}`, detail: "", badge: days ? `D+${String(days).padStart(2, "0")}` : "오늘",
  href: `/payment?row=${index + 3}&slot=1`, dueISO: "2026-09-01", overdueDays: days, action: "서류 확인", reasons: ["미완료 투두"], facts: [], ...over,
});
const many = Array.from({ length: 36 }, (_, index) => make(index, index % 30));

let root: Root, host: HTMLDivElement;
type Fake = { finished: Promise<void>; ready: Promise<void>; skipTransition: ReturnType<typeof vi.fn>; finish: () => void };
let started: Array<Fake & { classes: string }>;
/** 브라우저의 startViewTransition 흉내 — 상태 변경 콜백을 바로 부르고, finish() 를 부를 때까지 전환이 도는 중으로 둔다. */
function stubViewTransitions() {
  started = [];
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: (update: () => void) => {
    const classes = document.documentElement.className;
    let finish = () => {};
    const finished = new Promise<void>(resolve => { finish = resolve; });
    update();
    const fake = { finished, ready: Promise.resolve(), skipTransition: vi.fn(() => finish()), finish, classes };
    started.push(fake);
    return fake;
  } });
}
const reduceMotion = (matches: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches && query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {} }));

beforeEach(() => { window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  document.documentElement.className = "";
});
const render = (items: FollowUpItem[] = many) => act(() => root.render(React.createElement(DashboardFollowUpsView, { items })));
const click = (element: Element | null) => act(() => (element as HTMLElement).click());
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const rows = () => [...host.querySelectorAll<HTMLElement>(".tz-row:not(.tz-row-empty)")];
const names = () => rows().map(r => r.style.getPropertyValue("--tz-vt-name")).filter(Boolean);
const chips = () => [...host.querySelectorAll<HTMLButtonElement>(".tz-chip")];

describe("① 이어지는 전환 — 줄 이름", () => {
  it("item.key 를 겹치지 않는 CSS 식별자로 바꾼다(한글·기호·밑줄 포함, 1:1)", () => {
    const keys = ["stalled:10:2", "stalled_10_2", "stalled:10:2 ", "todo:todo-many-5", "2026-09-01|샘플 한빛상사", "2026-09-01|샘플 한빛상사|", "lead:00000000-0000-4000-8000-000000000006", "a_3a_b", "a:b", ""];
    const out = keys.map(followUpTransitionName);
    expect(new Set(out).size).toBe(keys.length);
    for (const name of out) expect(name).toMatch(/^tz-row-[a-zA-Z0-9_-]*$/);
    expect(followUpTransitionName("stalled:10:2")).toBe("tz-row-stalled_3a_10_3a_2");
  });

  it("화면에 그린 줄마다 이름이 다르고, 앞쪽 6줄에만 붙는다 — 36건을 펼쳐도 늘지 않는다", () => {
    render();
    expect(NAMED_ROWS).toBe(6);
    expect(names()).toHaveLength(6);
    expect(new Set(names()).size).toBe(6);
    click(host.querySelector(".tz-more"));
    expect(rows()).toHaveLength(36);
    expect(names()).toHaveLength(6);
    expect(new Set(names()).size).toBe(6);
    // 좁힌 목록도 겹치지 않는다(겹치면 브라우저가 전환을 통째로 취소한다).
    click(chips()[1]!);
    expect(new Set(names()).size).toBe(names().length);
    expect(names().length).toBeGreaterThan(0);
  });

  it("이름·길이·곡선은 전환이 도는 동안(html.tz-vt)에만 걸리고 페이지 전체(root)는 전환에서 뺀다", () => {
    const css = readFileSync("components/dashboard/dashboard-task-zone.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.match(/[^{}]*view-transition[^{}]*\{[^}]*\}/g) ?? []) expect(rule.trim(), rule).toMatch(/^html\.tz-vt/);
    expect(css).toContain("html.tz-vt { view-transition-name:none; }");
    expect(css).toContain("html.tz-vt-zone .tz-zone { view-transition-name:tz-zone; }");
    expect(css).toContain("html.tz-vt:not(.tz-vt-zone) .tz-row { view-transition-name:var(--tz-vt-name, none); }");
    expect(css).toContain("html.tz-vt::view-transition-group(*) { animation-duration:240ms; animation-timing-function:cubic-bezier(0.2, 0.8, 0.2, 1); }");
    // 튕김·탄성 곡선 없음, 200~260ms.
    expect(css).not.toMatch(/cubic-bezier\([^)]*(1\.[1-9]|-0?\.[0-9])/);
    for (const ms of css.match(/animation-duration:(\d+)ms/g) ?? []) expect(Number(ms.match(/\d+/)![0])).toBeLessThanOrEqual(260);
    // 다른 화면의 CSS 는 이 전환을 모른다.
    expect(readFileSync("app/globals.css", "utf8")).not.toContain("view-transition");
  });
});

describe("① 이어지는 전환 — 시작·건너뛰기·대체", () => {
  it("지원하지 않는 브라우저에서는 지금처럼 즉시 바뀐다", () => {
    render();
    click(chips()[3]!);
    expect(chips()[3]!.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.className).toBe("");
  });

  it("칩·단계로 좁히면 줄만 잇고(tz-vt), 펼침/접기는 구역 상자까지 잇는다(tz-vt-zone) — 끝나면 클래스를 지운다", async () => {
    stubViewTransitions(); reduceMotion(false);
    render();
    click(chips()[2]!);
    expect(started).toHaveLength(1);
    expect(started[0]!.classes).toBe("tz-vt");
    expect(chips()[2]!.getAttribute("aria-pressed")).toBe("true");
    started[0]!.finish(); await settle();
    expect(document.documentElement.className).toBe("");

    click(host.querySelector(".tz-step"));
    expect(started[1]!.classes).toBe("tz-vt");
    started[1]!.finish(); await settle();

    click(host.querySelector(".tz-more"));
    expect(started[2]!.classes).toBe("tz-vt tz-vt-zone");
    expect(host.querySelector(".tz-list")!.getAttribute("data-open")).toBe("true");
    started[2]!.finish(); await settle();
    expect(document.documentElement.className).toBe("");
  });

  it("연타하면 돌던 전환은 건너뛰고 마지막 선택이 남는다", async () => {
    stubViewTransitions(); reduceMotion(false);
    render();
    click(chips()[1]!); click(chips()[2]!); click(chips()[3]!);
    expect(started).toHaveLength(3);
    expect(started[0]!.skipTransition).toHaveBeenCalledOnce();
    expect(started[1]!.skipTransition).toHaveBeenCalledOnce();
    expect(started[2]!.skipTransition).not.toHaveBeenCalled();
    expect(chips().map(c => c.getAttribute("aria-pressed"))).toEqual(["false", "false", "false", "true"]);
    await settle();
    // 건너뛴 앞 전환이 끝나도 지금 도는 전환의 표시는 지우지 않는다.
    expect(document.documentElement.className).toBe("tz-vt");
    started[2]!.finish(); await settle();
    expect(document.documentElement.className).toBe("");
  });

  it("동작 줄이기가 켜져 있으면 전환을 시작하지 않는다", () => {
    stubViewTransitions(); reduceMotion(true);
    render();
    click(host.querySelector(".tz-more"));
    click(chips()[3]!);
    expect(started).toHaveLength(0);
    expect(rows().length).toBeGreaterThan(0);
    expect(chips()[3]!.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.className).toBe("");
  });

  it("남은 일이 0건이 되면 구역이 접히는 것도 전환 안에서 — 그 순간에만 체크가 톡(fx-check-pop)", async () => {
    stubViewTransitions(); reduceMotion(false);
    render(many.slice(0, 3));
    expect(started).toHaveLength(0);
    render(many.slice(0, 2)); // 건수만 줄면 전환 없이 바로
    expect(started).toHaveLength(0);
    expect(rows()).toHaveLength(2);
    render([]);
    expect(started).toHaveLength(1);
    expect(started[0]!.classes).toBe("tz-vt tz-vt-zone");
    const zone = host.querySelector<HTMLElement>("[data-dashboard-follow-ups]")!;
    expect(zone.dataset.state).toBe("done");
    expect(zone.querySelector(".tz-state-icon svg")!.classList.contains("fx-check-pop")).toBe(true);
    started[0]!.finish(); await settle();
    render(many.slice(0, 1)); // 반대 방향
    expect(started).toHaveLength(2);
    expect(zone.dataset.state).toBe("list");
  });

  it("처음부터 0건으로 열린 화면은 전환도 체크 효과도 없다", () => {
    stubViewTransitions(); reduceMotion(false);
    render([]);
    expect(started).toHaveLength(0);
    expect(host.querySelector(".fx-check-pop")).toBeNull();
  });

  it("화면을 떠나면 돌던 전환을 건너뛰고 표시를 지운다", () => {
    stubViewTransitions(); reduceMotion(false);
    render();
    click(chips()[1]!);
    act(() => root.unmount());
    expect(started[0]!.skipTransition).toHaveBeenCalled();
    expect(document.documentElement.className).toBe("");
    root = createRoot(host);
  });
});

describe("② 선택 바탕이 옮겨 가는 칩", () => {
  /** 칩 자리 흉내: 넷째 칩은 둘째 줄로 넘어간다(모바일 375). 폭은 글자 수만큼. */
  function layout() {
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("tz-chips")) return new DOMRect(20, 100, 320, 80);
      if (this.classList.contains("tz-chip")) {
        const index = chips().indexOf(this as HTMLButtonElement);
        const width = 30 + this.textContent!.trim().length * 9.5;
        const lefts = chips().slice(0, index).reduce((sum, c) => sum + 30 + c.textContent!.trim().length * 9.5 + 6, 0);
        return index === 3 ? new DOMRect(20, 142, width, 36) : new DOMRect(20 + lefts, 100, width, 36);
      }
      return new DOMRect(0, 0, 0, 0);
    });
  }
  const thumb = () => host.querySelector<HTMLElement>(".tz-chips > .slide-thumb")!;

  it("자리를 못 재면(서버 렌더·숨은 화면) 표시를 그리지 않고 칩이 제 바탕을 쓴다", () => {
    render();
    expect(thumb().hasAttribute("data-on")).toBe(false);
    expect(thumb().getAttribute("aria-hidden")).toBe("true");
    expect(chips()[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("눌린 칩의 자리·크기로 옮겨 간다 — 둘째 줄로 넘어간 칩도, 건수로 폭이 달라져도 맞는다", () => {
    const spy = layout();
    try {
      render();
      const all = chips()[0]!.getBoundingClientRect();
      expect(thumb().hasAttribute("data-on")).toBe(true);
      expect(thumb().style.transform).toBe("translate(0px, 0px)");
      expect(thumb().style.width).toBe(`${all.width}px`);
      expect(thumb().style.height).toBe("36px");

      click(chips()[1]!);
      const second = chips()[1]!.getBoundingClientRect();
      expect(thumb().style.transform).toBe(`translate(${second.left - 20}px, 0px)`);
      expect(thumb().style.width).toBe(`${second.width}px`);

      click(chips()[3]!); // 둘째 줄
      expect(thumb().style.transform).toBe("translate(0px, 42px)");
      expect(chips().map(c => c.getAttribute("aria-pressed"))).toEqual(["false", "false", "false", "true"]);

      // 건수가 세 자리가 되면 폭이 늘어난 만큼 다시 잰다.
      click(chips()[0]!);
      render(Array.from({ length: 123 }, (_, index) => make(index, 9)));
      expect(chips()[0]!.textContent).toContain("123");
      expect(thumb().style.width).toBe(`${chips()[0]!.getBoundingClientRect().width}px`);
    } finally { spy.mockRestore(); }
  });

  it("표시는 장식이다 — 칩의 흰 바탕 아래도, 글자 위도 아닌 사이 층. 동작 줄이기면 즉시 옮긴다", () => {
    const css = readFileSync("components/motion/sliding-thumb.css", "utf8");
    expect(css).toContain("transition:transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), width 220ms cubic-bezier(0.2, 0.8, 0.2, 1), height 220ms cubic-bezier(0.2, 0.8, 0.2, 1)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .slide-thumb { transition:none; } }");
    expect(css).toContain(".slide-thumb:not([data-on]) { display:none; }");
    expect(css).toMatch(/\.slide-thumb\[data-on\] ~ \[aria-pressed\]::before \{[^}]*z-index:-1/);
    expect(css).toContain("pointer-events:none");
    const zone = readFileSync("components/dashboard/dashboard-task-zone.css", "utf8");
    expect(zone).toMatch(/\.tz-chips \{[^}]*position:relative; isolation:isolate/);
  });
});

describe("② 기간 칩(PeriodPicker) — 선택 사항", () => {
  const props = { period: "all" as const, from: "", to: "", onPeriod: () => {}, onFrom: () => {}, onTo: () => {} };
  const show = (extra: Partial<React.ComponentProps<typeof PeriodPicker>> = {}) => act(() => root.render(React.createElement("div", { className: "relative" }, React.createElement(PeriodPicker, { ...props, ...extra }))));

  it("기본은 꺼져 있다 — 다른 화면(실무/수납 성과 요약·DB관리 유입일)의 모양·동작이 그대로", () => {
    show();
    expect(host.querySelector(".slide-thumb")).toBeNull();
    const pressed = host.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!;
    expect(pressed.dataset.period).toBe("all");
    expect(pressed.className).toBe("h-7 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold border-blue-500 bg-blue-50 text-blue-700");
    expect(host.firstElementChild!.children).toHaveLength(4);
    for (const src of ["app/(app)/payment/_components/PaymentPerformanceSummary.tsx", "app/(app)/db-sheet/_components/InflowPeriod.tsx", "components/dashboard/DashboardFinance.tsx"]) expect(readFileSync(src, "utf8")).not.toContain("slidingIndicator");
  });

  it("대시보드 맨 위 띠만 켠다 — 칩의 모양·눌림 상태는 그대로, 표시 하나만 더한다", () => {
    show({ slidingIndicator: true });
    const mark = host.querySelector(".slide-thumb")!;
    expect(mark.getAttribute("data-tone")).toBe("accent");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(host.firstElementChild!.firstElementChild).toBe(mark);
    expect(host.querySelectorAll("button")).toHaveLength(4);
    expect(host.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!.className).toContain("border-blue-500 bg-blue-50 text-blue-700");
    const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
    expect(page.match(/slidingIndicator/g)).toHaveLength(1);
    expect(page).toMatch(/data-testid="dashboard-period-chips"\s+className="relative isolate /);
  });
});
