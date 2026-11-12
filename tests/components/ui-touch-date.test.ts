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
  // 2차(2026-11-12) — 남은 11곳
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
];

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("결정 5 — 네이티브 날짜 칸 교체", () => {
  it.each(SWAPPED)("%s 는 DateInputCustom 을 쓴다", (p) => {
    const src = code(read(p));
    expect(src).not.toMatch(/type=["']date["']/);
    expect(src).toMatch(/<DateInputCustom\b/);
  });

  it("app·components 어디에도 네이티브 type=date 가 남지 않는다(예외 없음)", () => {
    const offenders = [...walk(resolve(root, "app")), ...walk(resolve(root, "components"))]
      .filter((p) => /type=\{?["']date["']\}?/.test(code(read(p))));
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

describe("DateInputCustom — 2차 교체에 필요한 계약(autoFocus·defaultOpen·clearable·Esc·aria)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  const mount = (node: React.ReactElement) => {
    const host = document.createElement("div");
    document.body.append(host);
    act(() => createRoot(host).render(node));
    return host;
  };

  it("autoFocus·defaultOpen 이면 처음부터 겉 칸에 포커스, 달력이 열린다", () => {
    mount(h(DateInputCustom, { value: "", onChange: () => {}, autoFocus: true, defaultOpen: true, ariaLabel: "다음 연락일" }));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("다음 연락일");
    expect(document.querySelector(".date-pop")).not.toBeNull();
  });

  it("clearable 이면 [지우기] 가 onChange('') 로 비운다 — 값이 없으면 비활성, 기본은 없음", () => {
    const seen: string[] = [];
    const host = mount(h(DateInputCustom, { value: "2026-11-12", onChange: (v: string) => seen.push(v), clearable: true }));
    act(() => host.querySelector<HTMLButtonElement>(".custom-date-wrapper")!.click());
    act(() => document.querySelector<HTMLButtonElement>(".date-pop-clear")!.click());
    expect(seen).toEqual([""]);
    expect(document.querySelector(".date-pop")).toBeNull();
    document.body.innerHTML = "";
    const plain = mount(h(DateInputCustom, { value: "2026-11-12", onChange: () => {} }));
    act(() => plain.querySelector<HTMLButtonElement>(".custom-date-wrapper")!.click());
    expect(document.querySelector(".date-pop-clear")).toBeNull();
  });

  it("열린 달력의 Esc 는 달력만 닫고 감싼 쪽(dialog cancel·부모 단축키)으로 새지 않는다", () => {
    let parentEsc = 0;
    const host = mount(h("div", { onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Escape") parentEsc += 1; } }, h(DateInputCustom, { value: "2026-11-12", onChange: () => {} })));
    const btn = host.querySelector<HTMLButtonElement>(".custom-date-wrapper")!;
    act(() => btn.click());
    const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      btn.dispatchEvent(ev);
    });
    expect(document.querySelector(".date-pop")).toBeNull();
    expect(ev.defaultPrevented).toBe(true); // <dialog> 의 cancel(닫힘) 기본 동작을 막는다
    expect(parentEsc).toBe(0);
    // 달력이 닫힌 뒤의 Esc 는 평소처럼 부모에게 간다.
    act(() => {
      btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(parentEsc).toBe(1);
  });

  it("달력 안 mousedown 은 포커스를 겉 칸에서 빼앗지 않는다(감싼 blur 저장이 고르기 전에 안 돈다)", () => {
    const host = mount(h(DateInputCustom, { value: "2026-11-12", onChange: () => {} }));
    act(() => host.querySelector<HTMLButtonElement>(".custom-date-wrapper")!.click());
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    document.querySelector(".date-pop-day")!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it("ariaInvalid·ariaDescribedBy 는 겉 칸에 그대로 붙는다", () => {
    const host = mount(h(DateInputCustom, { value: "", onChange: () => {}, ariaInvalid: false, ariaDescribedBy: "hint" }));
    const btn = host.querySelector(".custom-date-wrapper")!;
    expect(btn.getAttribute("aria-invalid")).toBe("false");
    expect(btn.getAttribute("aria-describedby")).toBe("hint");
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

describe("달력이 fixed 를 가두는 조상 밖으로 나온다(2026-11-12 주간 보드 미팅 창 「새 날짜」 안 눌림)", () => {
  it("backdrop-filter·transform 조상이면 trapsFixed = true, 평범한 조상·dialog 안이면 false", async () => {
    const { trapsFixed } = await import("@/components/ui/DateInputCustom");
    const mk = (style: string) => {
      const outer = document.createElement("div");
      outer.setAttribute("style", style);
      const inner = document.createElement("button");
      outer.appendChild(inner);
      document.body.appendChild(outer);
      return { outer, inner };
    };
    const a = mk("transform: translateX(0)");
    expect(trapsFixed(a.inner)).toBe(true);
    const b = mk("filter: blur(1px)");
    expect(trapsFixed(b.inner)).toBe(true);
    const c = mk("color: red");
    expect(trapsFixed(c.inner)).toBe(false);
    const dlg = document.createElement("dialog");
    dlg.setAttribute("style", "transform: translateX(0)");
    const inDlg = document.createElement("button");
    dlg.appendChild(inDlg);
    document.body.appendChild(dlg);
    expect(trapsFixed(inDlg)).toBe(false);
    for (const n of [a.outer, b.outer, c.outer, dlg]) n.remove();
  });
  it("주간 보드 창은 달력(role=dialog) 안을 눌러도 닫히지 않는다", () => {
    const src = readFileSync("app/(app)/schedule/_components/board/BoardPopover.tsx", "utf8");
    expect(src).toContain('t.closest("[role=dialog],[role=alertdialog],[data-board-keep]")');
  });
});
