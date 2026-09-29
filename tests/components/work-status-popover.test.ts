// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
Object.assign(globalThis, { React });
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import WorkStatusBar from "@/components/payment/WorkStatusBar";
import type { WorkStatusItem } from "@/lib/analytics/payment-work-status";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (key: string, status: WorkStatusItem["status"]): WorkStatusItem =>
  ({ key, status, row: 3, slot: 1, company: "예시상사", product: "", institution: "" }) as unknown as WorkStatusItem;

describe("전체 진행건 호버 팝업 (belie 2026-09-29)", () => {
  it("마우스 지점에서 뜨고, 화면 밖으로는 안 나가며, 제목줄이 상태 막대 색으로 채워진다", () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(h(WorkStatusBar, { items: [item("a", "waiting"), item("b", "progress"), item("c", "progress")], onNavigate: vi.fn() })));
    const bar = host.querySelector("[data-work-status-bar]") as HTMLElement;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({ left: 100, top: 0, right: 1100, bottom: 40, width: 1000, height: 40 } as DOMRect);
    const progress = host.querySelector('[aria-label="진행 2건"]') as HTMLElement;
    act(() => { progress.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 500 })); });
    let pop = host.querySelector("[data-work-status-popover]") as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.style.left).toBe("384px"); // 500 - 100 - 16
    const banner = pop.querySelector("[data-work-status-banner]") as HTMLElement;
    expect(banner.textContent).toContain("진행 2건");
    expect(banner.className).toContain("from-sky-400");
    // 오른쪽 끝에서 들어오면 폭(360) 만큼 안쪽으로 당긴다.
    const waiting = host.querySelector('[aria-label="진행대기 1건"]') as HTMLElement;
    act(() => { waiting.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 1090 })); });
    pop = host.querySelector("[data-work-status-popover]") as HTMLElement;
    expect(parseFloat(pop.style.left)).toBeLessThanOrEqual(1000 - parseFloat(pop.style.width));
    expect(pop.querySelector("[data-work-status-banner]")!.className).toContain("bg-slate-300");
    act(() => root.unmount()); host.remove();
  });
});
