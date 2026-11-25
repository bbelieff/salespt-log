// @vitest-environment jsdom
/**
 * 할 일 구역 — 줄의 종류·이유 칩과 오른쪽 열 「단계 · 종류 · 이유」 보기 전환(2026-11-25 belie 승인 B안). 합성 항목만 쓴다.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardFollowUpsView, { SIDE_VIEW_KEY } from "@/components/dashboard/DashboardFollowUpsView";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root, host: HTMLDivElement;
const make = (key: string, days: number, over: Partial<FollowUpItem> = {}): FollowUpItem => ({
  key, kind: "overdue", step: "4", group: days >= 7 ? "long-overdue" : days ? "overdue" : "today",
  title: `샘플 ${key}`, company: `샘플 ${key}`, detail: "합성 상세", badge: days ? `D+${String(days).padStart(2, "0")}` : "오늘",
  href: "/payment?row=3&slot=1", dueISO: "2026-09-01", overdueDays: days, action: "서류 확인", reasons: ["미완료 할 일"], facts: [], ...over,
});
const items: FollowUpItem[] = [
  make("stalled:1:1", 40, { action: "진행기관과 다음 할 일 확인", reasons: ["진행기관 없음", "다음 할 일 없음", "7일 이상 진행 정체"] }),
  make("stalled:2:1", 12, { action: "다음 할 일 정하기", reasons: ["다음 할 일 없음", "7일 이상 진행 정체"] }),
  make("stalled:3:1", 9, { action: "다음 할 일 정하기", reasons: ["다음 할 일 없음"] }),
  make("todo:1", 3, { action: "가상 서류 8" }),
  make("meeting:1", 31, { step: "3", action: "미팅 결과 입력", reasons: ["미팅 결과 미입력"] }),
  make("lead:1", 2, { step: "2", action: "다음 연락일 정하기", reasons: ["재통화 · 다음 연락일 없음"] }),
  make("lead:2", 0, { step: "2", action: "첫 연락하기", reasons: ["첫 연락 전"] }),
];

beforeEach(() => { window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = (list: FollowUpItem[] = items, props: Partial<React.ComponentProps<typeof DashboardFollowUpsView>> = {}) =>
  act(() => root.render(React.createElement(DashboardFollowUpsView, { items: list, ...props })));
const rows = () => [...host.querySelectorAll<HTMLElement>(".tz-row:not(.tz-row-empty)")];
const click = (element: Element | null) => act(() => (element as HTMLElement).click());
const view = (label: string) => [...host.querySelectorAll<HTMLButtonElement>(".tz-view")].find(b => b.textContent === label)!;
const picks = () => [...host.querySelectorAll<HTMLButtonElement>(".tz-pick")];
const companies = () => rows().map(r => r.querySelector(".tz-title strong")!.textContent);

describe("줄의 종류·이유 칩", () => {
  it("줄마다 종류 칩 하나, 이유 칩은 쉬운 말로 두 개까지 — 정보 없는 이유는 칩이 없다", () => {
    render();
    const byKey = (key: string) => rows().find(r => r.querySelector(".tz-title strong")!.textContent === `샘플 ${key}`)!;
    const chips = (key: string) => [...byKey(key).querySelectorAll(".tz-reasons > span")].map(s => s.textContent);
    expect(rows().map(r => r.querySelector(".tz-kind")!.textContent)).toEqual(["기록", "정하기", "정하기", "정하기", "날짜", "할 일"]);
    expect(chips("stalled:1:1")).toEqual(["기관 없음", "다음 할 일 비어 있음"]);
    expect(chips("lead:1")).toEqual(["재통화", "다음 연락일 없음"]);
    expect(byKey("todo:1").querySelector(".tz-reasons")).toBeNull();
    // 「열기」는 그대로 줄의 마지막 조작이고 도착 주소도 그대로다.
    expect(byKey("todo:1").querySelector("a.tz-go")!.getAttribute("href")).toBe("/payment?row=3&slot=1");
  });

  it("칩은 폰에서 숨고 PC 에서만 보인다 — 종류 칩은 PC 전체, 이유 칩은 넓을 때, 좁은 PC 는 단계 글자를 뺀다", () => {
    const css = readFileSync("components/dashboard/dashboard-task-zone.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const pc = css.slice(css.indexOf("@media (min-width:1024px)"), css.indexOf("@media (max-width:1023.98px)"));
    expect(css.slice(0, css.indexOf("@media (min-width:1024px)"))).toContain(".tz-kind, .tz-reasons { display:none; }");
    expect(pc).toContain(".tz-kind { display:inline-flex; }");
    expect(pc).toContain("@container tz-main (min-width:760px) { .tz-reasons { display:flex; grid-column:4; } }");
    expect(pc).toContain("@container tz-main (max-width:759.98px) { .tz-meta-step { display:none; } }");
    // 「열기」는 PC 에서 늘 다섯째 칸 — 이유 칩이 있든 없든 같은 줄.
    expect(pc).toContain(".tz-row > .tz-go { grid-column:5; }");
    render();
    expect(rows()[1]!.querySelector(".tz-meta-step")!.textContent).toBe("STEP 4 실무/수납 · ");
  });
});

describe("오른쪽 열 — 단계 · 종류 · 이유", () => {
  it("단계 보기: STEP 배지 흐름, DB생산은 흐리게, 가장 많이 몰린 단계에 「몰림」, 가장 오래 밀린 날수", () => {
    render();
    expect(view("단계").getAttribute("aria-pressed")).toBe("true");
    const off = host.querySelector(".tz-step-off")!;
    expect(off.textContent).toContain("STEP 1");
    expect(off.textContent).toContain("주간 목표에서");
    const steps = [...host.querySelectorAll<HTMLButtonElement>(".tz-step")];
    expect(steps.map(s => s.getAttribute("aria-label"))).toEqual(["STEP 2 DB관리 2건", "STEP 3 일정·계약 1건", "STEP 4 실무/수납 4건 · 가장 많이 몰림"]);
    expect(steps.map(s => s.querySelector("small")!.textContent)).toEqual(["가장 오래 D+02", "가장 오래 D+31 · 7일 넘게 밀림 1", "가장 오래 D+40 · 7일 넘게 밀림 3"]);
    expect(steps.filter(s => s.querySelector(".tz-crowded"))).toHaveLength(1);
    // 건수가 같으면 「몰림」은 붙지 않는다.
    render(items.filter(i => i.key !== "stalled:3:1" && i.key !== "todo:1"));
    expect(host.querySelector(".tz-crowded")).toBeNull();
  });

  it("종류 보기: 있는 종류만 건수와 함께, 누르면 목록이 좁혀지고 「…만 보는 중 · 풀기」가 뜬다", () => {
    render();
    click(view("종류"));
    expect(picks().map(p => p.getAttribute("aria-label"))).toEqual(["전화 1건", "날짜 1건", "기록 1건", "정하기 3건", "할 일 1건"]);
    click(picks()[3]!);
    expect(companies()).toEqual(["샘플 stalled:1:1", "샘플 stalled:2:1", "샘플 stalled:3:1"]);
    expect(host.querySelector(".tz-picked")!.textContent).toContain("정하기만 보는 중");
    click(host.querySelector(".tz-picked button"));
    expect(rows()).toHaveLength(6);
    expect(host.querySelector(".tz-picked")).toBeNull();
  });

  it("이유 보기: 많은 순, 합계 안내, 누르면 그 이유가 붙은 줄만", () => {
    render();
    click(view("이유"));
    expect(picks().map(p => p.getAttribute("aria-label")).slice(0, 3)).toEqual(["다음 할 일 비어 있음 3건", "7일 넘게 멈춤 2건", "결과 안 적음 1건"]);
    expect(host.querySelector(".tz-side-note")!.textContent).toContain("합계가 남은 건수보다 클 수 있습니다");
    click(picks()[1]!);
    expect(companies()).toEqual(["샘플 stalled:1:1", "샘플 stalled:2:1"]);
  });

  it("보기를 바꾸면 고른 조건이 풀리고, 급한 정도 칩과는 함께 걸린다", () => {
    render();
    click(host.querySelectorAll(".tz-step")[2]!);
    expect(rows()).toHaveLength(4);
    click(host.querySelector('.tz-chip[data-tone="long-overdue"]'));
    expect(companies()).toEqual(["샘플 stalled:1:1", "샘플 stalled:2:1", "샘플 stalled:3:1"]);
    click(view("종류"));
    expect(host.querySelector(".tz-picked")).toBeNull();
    // 급한 정도 칩은 그대로 걸려 있다.
    expect(host.querySelector('.tz-chip[data-tone="long-overdue"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(rows()).toHaveLength(4);
  });

  it("마지막으로 본 보기를 이 기기에 기억하고, 저장소를 못 써도 동작한다", () => {
    render();
    click(view("이유"));
    expect(window.localStorage.getItem(SIDE_VIEW_KEY)).toBe("reason");
    act(() => root.unmount()); root = createRoot(host);
    render();
    expect(view("이유").getAttribute("aria-pressed")).toBe("true");
    act(() => root.unmount()); root = createRoot(host);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render();
    expect(view("단계").getAttribute("aria-pressed")).toBe("true");
    click(view("종류"));
    expect(view("종류").getAttribute("aria-pressed")).toBe("true");
  });

  it("조회 실패(일부)면 건수 0 을 「—」로 보이고 「몰림」을 붙이지 않는다", () => {
    render(items.filter(i => i.step === "4").slice(0, 2), { incomplete: true });
    const steps = [...host.querySelectorAll<HTMLButtonElement>(".tz-step")];
    expect(steps[0]!.querySelector("strong")!.textContent).toBe("—");
    expect(steps[0]!.getAttribute("aria-label")).toBe("STEP 2 DB관리 확인 필요");
    expect(host.querySelector(".tz-crowded")).toBeNull();
  });
});
