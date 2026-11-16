// @vitest-environment jsdom
/** 업체정보 여러 줄 칸(기대출 개인·사업자 대출·기타메모)은 내용이 늘면 높이가 따라 늘어난다 (2026-11-17 belie). */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import CompanyInfoField, { GRIP_MAX, gripMinOf, loadFieldHeight, toggleGrip } from "@/components/company-info/CompanyInfoField";
import type { FieldDef } from "@/components/company-info-defs";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

it("값이 길어지면 내용 높이(scrollHeight)에 맞춰 늘어나고, 한 줄 칸은 건드리지 않는다", () => {
  // 합성 측정값: 글자 60자마다 한 줄(20px) — 줄바꿈 없이 길게 적어도 접힌 줄만큼 늘어야 한다.
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return Math.max(2, Math.ceil(this.value.length / 60)) * 20; });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const def = (k: string, multi?: boolean) => [k, k, k, 2, multi] as unknown as FieldDef;
  const draw = (value: string) => React.act(() => root.render(React.createElement(React.Fragment, null,
    React.createElement(CompanyInfoField, { def: def("기대출개인", true), value, onChange: () => {}, id: "a" }),
    React.createElement(CompanyInfoField, { def: def("개업일"), value: "25.01.24", onChange: () => {}, id: "b" }))));
  draw("캐피탈 38백만");
  const area = host.querySelector("textarea")!;
  expect(area.style.height).toBe("40px");
  expect(area.className).toContain("overflow-hidden");
  draw("가".repeat(300)); // 줄바꿈 없는 긴 글 → 5줄
  expect(area.style.height).toBe("100px");
  draw("짧게");
  expect(area.style.height).toBe("40px"); // 지우면 다시 줄어든다
  expect((host.querySelector("#b") as HTMLInputElement).style.height).toBe("");
  React.act(() => root.unmount()); host.remove();
});

it("아래 손잡이를 끌면 높이를 직접 정하고, 두 번 누르면 최소 ↔ 최대(내용 전체)", () => {
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return Math.max(2, Math.ceil(this.value.length / 60)) * 20; });
  vi.spyOn(HTMLTextAreaElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return parseInt(this.style.height, 10) || 0; });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  React.act(() => root.render(React.createElement(CompanyInfoField, { def: ["기대출개인", "기대출 개인", "설명", 2, true] as unknown as FieldDef, value: "가".repeat(300), onChange: () => {}, id: "a" })));
  const area = host.querySelector("textarea")!, grip = host.querySelector<HTMLElement>('[role="separator"]')!;
  expect(grip.getAttribute("aria-label")).toBe("기대출 개인 칸 높이 조절");
  const GRIP_MIN = gripMinOf(area); // jsdom: 줄 높이를 못 재면 20px 두 줄 = 40
  expect(GRIP_MIN).toBe(40);
  expect(area.style.height).toBe("100px"); // 처음엔 내용 전체(최대)
  const fire = (type: string, y: number) => React.act(() => { const e = new Event(type, { bubbles: true }); Object.assign(e, { clientY: y, pointerId: 1 }); grip.dispatchEvent(e); });
  fire("pointerdown", 500); fire("pointermove", 460); fire("pointerup", 460); // 40px 위로 → 줄인다
  expect(area.style.height).toBe("60px");
  expect(area.className).toContain("overflow-y-auto"); // 줄이면 칸 안에서 스크롤
  fire("pointerdown", 460); fire("pointermove", 100); fire("pointerup", 100); // 한참 위로 → 최소에서 멈춤
  expect(area.style.height).toBe(`${GRIP_MIN}px`);
  React.act(() => { grip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }); // 최소 → 최대
  expect(area.style.height).toBe("100px");
  expect(area.className).toContain("overflow-hidden");
  React.act(() => { grip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }); // 최대 → 최소
  expect(area.style.height).toBe(`${GRIP_MIN}px`);
  expect(toggleGrip(null, 40)).toBe(40); expect(toggleGrip(40, 40)).toBeNull(); expect(toggleGrip(300, 40)).toBe(40);
  expect(GRIP_MAX).toBeGreaterThan(GRIP_MIN);
  React.act(() => root.unmount()); host.remove();
});

it("정한 높이를 칸 종류마다 기억한다 — 다시 열면 그 높이, 최대로 되돌리면 기억을 지운다", () => {
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return Math.max(2, Math.ceil(this.value.length / 60)) * 20; });
  vi.spyOn(HTMLTextAreaElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return parseInt(this.style.height, 10) || 0; });
  const def = (k: string) => [k, k, k, 2, true] as unknown as FieldDef;
  const open = () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    React.act(() => root.render(React.createElement(React.Fragment, null,
      React.createElement(CompanyInfoField, { def: def("기대출개인"), value: "가".repeat(300), onChange: () => {}, id: "a" }),
      React.createElement(CompanyInfoField, { def: def("기타메모"), value: "가".repeat(300), onChange: () => {}, id: "b" }))));
    const areas = host.querySelectorAll("textarea"), grip = host.querySelector<HTMLElement>('[role="separator"]')!;
    return { a: areas[0]!, b: areas[1]!, grip, close: () => { React.act(() => root.unmount()); host.remove(); } };
  };
  const fire = (grip: HTMLElement, type: string, y: number) => React.act(() => { const e = new Event(type, { bubbles: true }); Object.assign(e, { clientY: y, pointerId: 1 }); grip.dispatchEvent(e); });
  let v = open();
  fire(v.grip, "pointerdown", 500); fire(v.grip, "pointermove", 560); fire(v.grip, "pointerup", 560); // 100 → 160
  expect(v.a.style.height).toBe("160px");
  expect(loadFieldHeight("기대출개인")).toBe(160);
  expect(loadFieldHeight("기타메모")).toBeNull(); // 다른 칸은 그대로
  v.close();
  v = open(); // 화면을 나갔다 다시 열기(다른 업체여도 같은 칸)
  expect(v.a.style.height).toBe("160px");
  expect(v.a.className).toContain("overflow-y-auto");
  expect(v.b.style.height).toBe("100px"); // 정한 적 없는 칸은 내용 높이
  React.act(() => { v.grip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }); // → 최소(기억)
  expect(loadFieldHeight("기대출개인")).toBe(40);
  React.act(() => { v.grip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }); // → 최대(자동) = 기억 지움
  expect(loadFieldHeight("기대출개인")).toBeNull();
  v.close();
  v = open();
  expect(v.a.style.height).toBe("100px");
  v.close();
  window.localStorage.setItem("ci-field-height:기대출개인", "99999"); // 망가진 값은 위쪽 한계로
  expect(loadFieldHeight("기대출개인")).toBe(GRIP_MAX);
  window.localStorage.setItem("ci-field-height:기대출개인", "abc");
  expect(loadFieldHeight("기대출개인")).toBeNull();
});
