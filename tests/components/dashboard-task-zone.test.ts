// @vitest-environment jsdom
/**
 * 할 일 구역 화면(DashboardFollowUpsView, 2026-11-24 개편) — 줄 목록·펼침·안내 문장·처리 건수·최악 데이터.
 * 옛 「단계×구간 숫자표 + 호버 팝업」 시험(dashboard-follow-ups-table.test.ts)을 대체한다 — 그 화면은 없어졌다.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardFollowUpsView from "@/components/dashboard/DashboardFollowUpsView";
import { HANDLED_TODAY_KEY } from "@/components/dashboard/useHandledToday";
import type { FollowUpItem, FollowUpStep } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root, host: HTMLDivElement;
const make = (index: number, days: number, over: Partial<FollowUpItem> = {}): FollowUpItem => ({
  key: `example:${index}`, kind: "overdue", step: "4", group: days >= 7 ? "long-overdue" : days ? "overdue" : "today",
  title: `샘플 업체${index}`, company: `샘플 업체${index}`, detail: "합성 상세", badge: days ? `D+${String(days).padStart(2, "0")}` : "오늘",
  href: `/payment?row=${index + 3}&slot=1`, dueISO: `2026-09-${String(30 - Math.min(days, 29)).padStart(2, "0")}`, overdueDays: days,
  action: "서류 확인", reasons: ["미완료 투두"], facts: [{ label: "기관", value: "합성 기관" }], ...over,
});
const records = [0, 3, 26, 9, 22, 3, 14].map((days, index) => make(index, days));
const many = Array.from({ length: 36 }, (_, index) => make(index, index % 30, { step: (["2", "3", "4"] as FollowUpStep[])[index % 3]! }));

beforeEach(() => { window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = (items: FollowUpItem[] = records, props: Partial<React.ComponentProps<typeof DashboardFollowUpsView>> = {}) =>
  act(() => root.render(React.createElement(DashboardFollowUpsView, { items, ...props })));
const zone = () => host.querySelector<HTMLElement>("[data-dashboard-follow-ups]")!;
const rows = () => [...host.querySelectorAll<HTMLElement>(".tz-row:not(.tz-row-empty)")];
const badges = () => rows().map(r => r.querySelector(".ft-badge")!.textContent);
const more = () => host.querySelector<HTMLButtonElement>(".tz-more");
const click = (element: Element | null) => act(() => (element as HTMLElement).click());

describe("할 일 구역 — 줄 목록", () => {
  it("급한 순서로 PC 6줄까지 보이고 「남은 N건 모두 보기」로 그 자리에서 펼친다", () => {
    render();
    expect(badges()).toEqual(["D+26", "D+22", "D+14", "D+09", "D+03", "D+03"]);
    expect(more()!.textContent).toContain("남은 7건 모두 보기");
    expect(more()!.getAttribute("data-pc-hidden")).toBe("false");
    expect(host.querySelector(".tz-list")!.getAttribute("data-open")).toBe("false");
    click(more());
    expect(badges()).toEqual(["D+26", "D+22", "D+14", "D+09", "D+03", "D+03", "오늘"]);
    expect(host.querySelector(".tz-list")!.getAttribute("data-open")).toBe("true");
    expect(more()!.textContent).toContain("접기");
    expect(more()!.getAttribute("aria-expanded")).toBe("true");
    click(more());
    expect(rows()).toHaveLength(6);
  });

  it("폰은 CSS 가 3줄까지만 보이고, 펼친 목록은 안쪽 스크롤이다", () => {
    const css = readFileSync("components/dashboard/dashboard-task-zone.css", "utf8");
    const phone = css.slice(css.indexOf("@media (max-width:1023.98px)"));
    expect(phone).toContain(".tz-list:not([data-open=true]) > .tz-row:nth-child(n+4) { display:none; }");
    expect(css).toMatch(/\.tz-list\[data-open=true\] \{ max-height:min\([\d.]+rem, 70vh\); max-height:min\([\d.]+rem, 70dvh\); overflow-y:auto; overscroll-behavior:contain;/);
    // 4~6건이면 「모두 보기」는 폰에서만 필요하다. 3건 이하면 어디서도 없다.
    render(records.slice(0, 4));
    expect(more()!.getAttribute("data-pc-hidden")).toBe("true");
    render(records.slice(0, 3));
    expect(more()).toBeNull();
  });

  it("한 줄 = 배지 · 업체 · 해야 할 일 · 「STEP n 단계 · 기준일 · 기관」 · 열기, 맨 윗줄만 주 버튼", () => {
    render();
    const first = rows()[0]!;
    expect(first.querySelector(".tz-title")!.textContent).toBe("샘플 업체2 · 서류 확인");
    expect(first.querySelector(".tz-what small")!.textContent).toBe("STEP 4 실무/수납 · 기준일 09.04 · 합성 기관");
    const go = first.querySelector("a.tz-go")!;
    expect(go.getAttribute("href")).toBe("/payment?row=5&slot=1");
    expect(go.getAttribute("aria-label")).toBe("샘플 업체2 서류 확인 열기");
    expect(rows().map(r => r.querySelector("a.tz-go")!.classList.contains("btn-depth-blue"))).toEqual([true, false, false, false, false, false]);
  });

  it("줄을 누르면 이유와 세부 정보가 그 줄 아래에 펼쳐진다(한 번에 한 줄)", () => {
    render();
    click(rows()[0]!.querySelector(".tz-what"));
    expect(rows()[0]!.querySelector(".tz-what")!.getAttribute("aria-expanded")).toBe("true");
    const detail = rows()[0]!.querySelector(".tz-detail")!;
    expect(detail.textContent).toContain("미완료 투두");
    expect(detail.textContent).toContain("합성 상세");
    expect(detail.textContent).toContain("기준일2026-09-04");
    expect(detail.textContent).toContain("기관합성 기관");
    click(rows()[1]!.querySelector(".tz-what"));
    expect(host.querySelectorAll(".tz-detail")).toHaveLength(1);
    expect(rows()[1]!.querySelector(".tz-detail")).not.toBeNull();
  });

  it("단계로 좁히면 「해당 N건」이 되고, 해당하는 일이 없으면 전체로 돌아가는 길을 알려 준다", () => {
    render(many);
    const step = (i: number) => host.querySelectorAll<HTMLButtonElement>(".tz-step")[i]!;
    expect(step(0).getAttribute("aria-label")).toBe("STEP 2 DB관리 12건");
    click(step(0));
    expect(more()!.textContent).toContain("해당 12건 모두 보기");
    // 사용자가 직접 0건짜리 조건을 고르면(합성 기록은 전부 STEP 4) 그대로 두고 길을 알려 준다.
    act(() => root.unmount()); root = createRoot(host);
    render(records);
    click(step(0));
    expect(step(0).getAttribute("aria-pressed")).toBe("true");
    expect(rows()).toHaveLength(0);
    expect(host.querySelector(".tz-row-empty")!.textContent).toContain("위의 「전체」를 누르면 남은 일을 모두 볼 수 있습니다.");
    expect(more()).toBeNull();
  });

  it("좁혀 둔 조건의 일이 조회가 바뀌어 하나도 안 남으면 조건을 풀어 남은 일을 보여 준다(2026-11-25 검수)", () => {
    render(many);
    const step = (i: number) => host.querySelectorAll<HTMLButtonElement>(".tz-step")[i]!;
    const chip = (tone: string) => host.querySelector<HTMLButtonElement>(`.tz-chip[data-tone="${tone}"]`)!;
    click(step(0));
    click(chip("today"));
    expect(step(0).getAttribute("aria-pressed")).toBe("true");
    expect(chip("today").getAttribute("aria-pressed")).toBe("true");
    expect(rows().length).toBeGreaterThan(0);
    // STEP 2 의 일이 전부 처리돼 사라졌다(다른 단계의 일은 남아 있다).
    render(many.filter(item => item.step !== "2"));
    expect(step(0).getAttribute("aria-pressed")).toBe("false");
    expect(chip("all").getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector(".tz-row-empty")).toBeNull();
    expect(rows()).toHaveLength(6);
    // 조건에 맞는 일이 아직 남아 있으면 건드리지 않는다.
    click(step(2));
    render(many.filter(item => item.step !== "2").slice(0, 20));
    expect(step(2).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("할 일 구역 — 목표 문장과 용어", () => {
  it("15건을 넘으면 「5건만 먼저」, 아니면 「가장 급한 일이 맨 위」", () => {
    render(many.slice(0, 15));
    expect(host.querySelector(".tz-count")!.textContent).toBe("15건 남았어요");
    expect(host.querySelector(".tz-hint")!.textContent).toBe("0건이 되면 오늘 챙길 일은 끝입니다. 가장 급한 일이 맨 위에 있어요.");
    render(many.slice(0, 16));
    expect(host.querySelector(".tz-hint")!.textContent).toBe("0건이 되면 오늘 챙길 일은 끝입니다. 밀린 일이 많을 땐 위에서부터 5건만 먼저 끝내 보세요.");
  });

  it("「장기누락·경과」 대신 「7일 넘게 밀림·밀림」 — 칩·막대 설명 어디에도 옛 이름이 없다", () => {
    render();
    expect([...host.querySelectorAll(".tz-chip")].map(c => c.textContent!.replace(/\s+/g, " ").trim())).toEqual(["전체 7", "7일 넘게 밀림 4", "밀림 2", "오늘 1"]);
    expect(host.querySelector(".tz-bar")!.getAttribute("aria-label")).toBe("남은 일 7건 — 7일 넘게 밀림 4건, 밀림 2건, 오늘 1건");
    // 「세는 기준」 안내는 없앴다(belie 2026-11-25).
    expect(host.querySelector(".tz-rules")).toBeNull();
    expect(zone().textContent).not.toMatch(/장기누락|경과/);
  });

  it("비율 막대와 단계 작은 막대는 건수만큼 자란다", () => {
    render();
    const grow = (root: Element) => Object.fromEntries([...root.querySelectorAll<HTMLElement>("i")].map(i => [i.dataset.seg, i.style.flexGrow]));
    expect(grow(host.querySelector(".tz-bar")!)).toEqual({ done: "0", "long-overdue": "4", overdue: "2", today: "1", unknown: "0" });
    expect(grow(host.querySelectorAll(".tz-step")[2]!.querySelector(".tz-mini")!)).toEqual({ "long-overdue": "4", overdue: "2", today: "1" });
    expect(grow(host.querySelectorAll(".tz-step")[0]!.querySelector(".tz-mini")!)).toEqual({ "long-overdue": "0", overdue: "0", today: "0" });
  });
});

describe("할 일 구역 — 오늘 처리 N건(이 기기 기억)", () => {
  const TODAY = "2026-10-12";
  it("그날 본 남은 건수의 최댓값을 기준으로 센다 — 값이 없으면 표시하지 않는다", () => {
    render(records, { todayISO: TODAY });
    expect(host.querySelector(".tz-done")).toBeNull();
    render(records.slice(0, 4), { todayISO: TODAY });
    expect(host.querySelector(".tz-done")!.textContent).toBe("오늘 3건 처리");
    expect(host.querySelector<HTMLElement>('.tz-bar [data-seg="done"]')!.style.flexGrow).toBe("3");
    expect(host.querySelector(".tz-bar")!.getAttribute("aria-label")).toContain("오늘 처리 3건, 남은 일 4건");
    expect(JSON.parse(window.localStorage.getItem(HANDLED_TODAY_KEY)!)).toEqual({ date: TODAY, peak: 7 });
    // 다 끝내면 접힌 한 줄에도 남는다.
    render([], { todayISO: TODAY });
    expect(zone().dataset.state).toBe("done");
    expect(zone().textContent).toContain("오늘 7건을 처리했습니다.");
  });

  it("날짜가 바뀌면 어제 값은 버린다", () => {
    window.localStorage.setItem(HANDLED_TODAY_KEY, JSON.stringify({ date: "2026-10-11", peak: 40 }));
    render(records, { todayISO: TODAY });
    expect(host.querySelector(".tz-done")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(HANDLED_TODAY_KEY)!)).toEqual({ date: TODAY, peak: 7 });
  });

  it("todayISO 를 주지 않거나 조회가 일부 실패했으면 세지도 적지도 않는다", () => {
    window.localStorage.setItem(HANDLED_TODAY_KEY, JSON.stringify({ date: TODAY, peak: 40 }));
    render(records);
    expect(host.querySelector(".tz-done")).toBeNull();
    render(records, { todayISO: TODAY, incomplete: true });
    expect(host.querySelector(".tz-done")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(HANDLED_TODAY_KEY)!).peak).toBe(40);
  });

  it("저장소를 쓸 수 없어도(읽기·쓰기 모두 실패) 화면은 그대로 나온다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("합성 차단"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("합성 차단"); });
    render(records, { todayISO: TODAY });
    expect(rows()).toHaveLength(6);
    render(records.slice(0, 4), { todayISO: TODAY });
    expect(host.querySelector(".tz-count")!.textContent).toBe("4건 남았어요");
    // 이번 화면에서 본 값만으로는 센다(탭을 닫으면 사라진다).
    expect(host.querySelector(".tz-done")!.textContent).toBe("오늘 3건 처리");
  });

  it("깨진 저장값은 없는 것으로 본다", () => {
    window.localStorage.setItem(HANDLED_TODAY_KEY, "{not json");
    render(records, { todayISO: TODAY });
    expect(host.querySelector(".tz-done")).toBeNull();
    expect(rows()).toHaveLength(6);
  });
});

describe("할 일 구역 — 상태와 최악 데이터", () => {
  it("조회 실패로 확인된 일이 없으면 0건·완료가 아니라 확인 필요", () => {
    render([], { incomplete: true });
    expect(zone().dataset.state).toBe("unconfirmed");
    expect(zone().textContent).toContain("확인 필요");
    expect(zone().textContent).not.toMatch(/0건|끝냈어요/);
    render(records, { incomplete: true });
    expect(host.querySelector(".tz-count")!.textContent).toBe("확인된 7건 남았어요");
    expect(host.querySelectorAll(".tz-step")[0]!.querySelector("strong")!.textContent).toBe("—");
  });

  it("0건 = 한 줄로 접힘, 기록 없음 = DB 등록 안내", () => {
    render([]);
    expect(zone().dataset.state).toBe("done");
    expect(zone().textContent).toContain("오늘 챙길 일을 모두 끝냈어요");
    expect(zone().textContent).toContain("7일 안에 예정된 일도 없습니다.");
    expect(host.querySelector("[data-upcoming-trigger]")).toBeNull();
    expect(host.querySelector(".tz-grid")).toBeNull();
    render([], { firstRun: true });
    expect(zone().dataset.state).toBe("first");
    expect(host.querySelector("a.tz-go")!.getAttribute("href")).toBe("/db-sheet");
    // 기록이 없다고 했어도 챙길 일이 있으면 목록이 먼저다.
    render(records, { firstRun: true });
    expect(zone().dataset.state).toBe("list");
  });

  it("아주 긴 상호·D+100 이상·기관 없음도 줄 구조를 지킨다(잘라 숨기지 않는다)", () => {
    const long = "샘플".repeat(40) + "주식회사";
    render([make(0, 120, { company: long, title: long, action: "가".repeat(60), facts: [], dueISO: null, badge: "D+120" })]);
    const row = rows()[0]!;
    expect(row.querySelector(".ft-badge")!.textContent).toBe("D+120");
    expect(row.querySelector(".tz-title strong")!.textContent).toBe(long);
    expect(row.querySelector(".tz-what small")!.textContent).toBe("STEP 4 실무/수납 · 날짜 확인");
    const css = readFileSync("components/dashboard/dashboard-task-zone.css", "utf8");
    expect(css).toMatch(/\.tz-title \{[^}]*overflow-wrap:anywhere/);
    expect(css).not.toMatch(/\.tz-title[^{]*\{[^}]*(text-overflow|line-clamp)/);
    expect(css).toMatch(/\.tz-row \{[^}]*grid-template-columns:minmax\(3\.5rem,max-content\) minmax\(0,1fr\) auto/);
  });

  it("36건이어도 접힌 목록은 6줄, 펼치면 36줄 전부", () => {
    render(many);
    expect(rows()).toHaveLength(6);
    expect(host.querySelector(".tz-count")!.textContent).toBe("36건 남았어요");
    click(more());
    expect(rows()).toHaveLength(36);
  });
});
