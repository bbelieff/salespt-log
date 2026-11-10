// @vitest-environment jsdom
/**
 * UI 결정 2·5 (2026-11-10) 가드.
 *  - 결정 2-A: 작은 버튼은 보이는 크기 그대로 두고 보이지 않는 누름 영역(hit-44)을 44px 로.
 *  - 결정 5: 화면의 네이티브 `<input type="date">` 를 요일이 보이는 DateInputCustom 으로.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import DateInputCustom from "@/components/ui/DateInputCustom";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(relative(root, p).replace(/\\/g, "/"));
  }
  return out;
}

/** 아직 네이티브 날짜 칸을 쓰는 곳 — 이번 범위 밖(DB 목록 담당 영역·셀 편집기·관리자·가계부). 새로 늘리지 않는다. */
const NATIVE_DATE_ALLOWED = new Set([
  "app/(app)/db-sheet/_components/AbsenceLog.tsx",
  "app/(app)/db-sheet/_components/CallConfirmScreen.tsx",
  "app/(app)/db-sheet/_components/Grid.tsx",
  "app/(app)/db-sheet/_components/ImportDialog.tsx",
  "app/(app)/db-sheet/_components/InflowPeriod.tsx",
  "app/admin/popup/_components/NoticeManager.tsx",
  "components/auth/CohortCreateModal.tsx",
  "components/auth/SeasonStartInput.tsx",
  "components/dashboard/expense-ledger/ExpenseEntryEditor.tsx",
  "components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx",
  "components/ui/PeriodPicker.tsx",
]);

const SWAPPED = [
  "app/(app)/calendar/_components/GeneralEventModal.tsx",
  "app/(app)/payment/_components/LinkedFieldsEditor.tsx",
  "app/(app)/payment/_components/PaymentSlotForm.tsx",
  "app/(app)/payment/_components/PriorContractRegister.tsx",
  "app/(app)/payment/_components/StandaloneCompanyAdd.tsx",
  "app/(app)/payment/_components/TodoFormModal.tsx",
  "app/(app)/payment/_components/TodoRow.tsx",
  "app/(app)/payment/_components/TodoSection.tsx",
  "app/(app)/schedule/_components/AddMeetingForm.tsx",
  "app/(app)/schedule/_components/BasicEditDetails.tsx",
  "app/(app)/schedule/_components/RescheduleForm.tsx",
];

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("결정 5 — 네이티브 날짜 칸 교체", () => {
  it.each(SWAPPED)("%s 는 DateInputCustom 을 쓴다", (p) => {
    const src = code(read(p));
    expect(src).not.toMatch(/type=["']date["']/);
    expect(src).toMatch(/<DateInputCustom\b/);
  });

  it("app·components 에 허용 목록 밖 type=date 가 새로 생기지 않는다", () => {
    const offenders = [...walk(resolve(root, "app")), ...walk(resolve(root, "components"))]
      .filter((p) => /type=["']date["']/.test(code(read(p))))
      .filter((p) => !NATIVE_DATE_ALLOWED.has(p));
    expect(offenders).toEqual([]);
  });
});

describe("DateInputCustom — 라벨·필수·비활성 계약", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  const mount = (node: React.ReactElement) => {
    const host = document.createElement("div");
    document.body.append(host);
    act(() => createRoot(host).render(node));
    return host;
  };

  it("겉 칸은 진짜 button — label htmlFor 를 누르면 달력이 열린다", () => {
    const host = mount(
      h("div", null, h("label", { htmlFor: "d1" }, "계약일"), h(DateInputCustom, { id: "d1", value: "2026-11-10", onChange: () => {} })),
    );
    const btn = host.querySelector<HTMLButtonElement>("#d1")!;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.type).toBe("button");
    expect(btn.textContent).toContain("2026-11-10 (화)");
    act(() => {
      host.querySelector("label")!.click();
    });
    expect(document.querySelector(".date-pop")).not.toBeNull();
  });

  it("required·name 이면 같은 값을 든 숨은 입력이 폼 검사·FormData 를 받는다", () => {
    const host = mount(h("form", null, h(DateInputCustom, { value: "", onChange: () => {}, required: true, name: "계약일" })));
    const proxy = host.querySelector<HTMLInputElement>('input[name="계약일"]')!;
    expect(proxy.required).toBe(true);
    expect(proxy.tabIndex).toBe(-1);
    expect(host.querySelector("form")!.checkValidity()).toBe(false);
  });

  it("disabled 면 눌러도 달력이 열리지 않는다", () => {
    const host = mount(h(DateInputCustom, { value: "2026-11-10", onChange: () => {}, disabled: true }));
    act(() => {
      host.querySelector<HTMLButtonElement>(".custom-date-wrapper")!.click();
    });
    expect(document.querySelector(".date-pop")).toBeNull();
  });

  it("Enter 로 열 때 감싼 줄의 Enter(저장) 단축키로 새지 않는다", () => {
    let leaked = 0;
    const host = mount(
      h("div", { onKeyDown: () => { leaked += 1; } }, h(DateInputCustom, { value: "2026-11-10", onChange: () => {} })),
    );
    act(() => {
      host.querySelector(".custom-date-wrapper")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(document.querySelector(".date-pop")).not.toBeNull();
    expect(leaked).toBe(0);
  });
});

describe("결정 2-A — 보이지 않는 44px 누름 영역", () => {
  const css = read("app/globals.css");

  it("공용 유틸 hit-44(·세그먼트용 hit-44-y) 가 ::after 로 44px 을 깐다", () => {
    expect(css).toMatch(/\.hit-44::after\s*\{[^}]*width:\s*max\(100%,\s*44px\)[^}]*height:\s*max\(100%,\s*44px\)/);
    expect(css).toMatch(/\.hit-44-y::after\s*\{[^}]*height:\s*max\(100%,\s*44px\)/);
  });

  it.each([
    ["app/(app)/contact/_components/ChannelTabsAndPanel.tsx", /stepper-btn hit-44/g, 4],
    ["app/(app)/db/_components/RowCard.tsx", /hit-44 /g, 2],
    ["app/(app)/schedule/_components/RescheduleForm.tsx", /hit-44 /g, 1],
    ["app/(app)/schedule/_components/CancelForm.tsx", /hit-44 /g, 1],
    ["components/ui/TimePicker15.tsx", /hit-44-y /g, 1],
    ["components/auth/TraineeCard.tsx", /hit-44 /g, 2],
    ["components/FontScaleControl.tsx", /hit-44 /g, 1],
  ] as const)("%s 에 적용", (p, re, n) => {
    expect(read(p).match(re)?.length ?? 0).toBeGreaterThanOrEqual(n);
  });

  it("이웃 버튼 누름 영역이 겹치지 않게 간격 8px(gap-2)", () => {
    const panel = read("app/(app)/contact/_components/ChannelTabsAndPanel.tsx");
    expect(panel).not.toMatch(/items-center gap-1">\s*<button\s+type="button"\s+className="stepper-btn/);
    expect(panel.match(/items-center gap-2">\s*<button\s+type="button"\s+className="stepper-btn/g)?.length).toBe(2);
    expect(read("app/(app)/db/_components/RowCard.tsx")).toMatch(/flex items-center gap-2">\s*<button\s+type="button"\s+onClick=\{onDeleteRequest\}/);
    // 세그먼트는 서로 붙어 있어 가로로 넓히면 겹친다 → 세로만(hit-44-y), 잘리지 않게 overflow-hidden 제거.
    expect(read("components/ui/TimePicker15.tsx")).not.toMatch(/overflow-hidden rounded-lg border/);
  });
});
