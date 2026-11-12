// @vitest-environment jsdom
/** 최상단 층 창 2차 (2026-11-12 결정 4 2차): 창 안 포털 위치 · 포털 팝업 Esc · DB정보 패널 Esc/바깥 누르기. 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AppDialog from "@/components/ui/AppDialog";
import { usePortalTarget } from "@/components/ui/top-layer";
import { DbDetail } from "@/app/(app)/db-sheet/_components/DbDetail";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { contactDraft } from "@/app/(app)/db-sheet/_components/ContactPanel";
import BugReportDialog from "@/components/bug-report/BugReportDialog";
import BadgeDetailSheet from "@/components/badges/BadgeDetailSheet";
import { BADGES } from "@/lib/analytics/badge-catalog";
import RecordMoveReceipt from "@/app/(app)/contact/_components/RecordMoveReceipt";

vi.mock("next/link", () => ({ default: (p: { href: string; children?: React.ReactNode }) => h("a", { href: p.href }, p.children) }));
vi.mock("@/components/CompanyInfoEditor", () => ({ default: () => h("div", null, "합성 업체정보") }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; };
  if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false; };
});

let root: Root, host: HTMLDivElement, trigger: HTMLButtonElement;
beforeEach(() => {
  localStorage.clear();
  trigger = document.createElement("button"); trigger.textContent = "열기"; document.body.append(trigger); trigger.focus();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); trigger.remove(); localStorage.clear(); vi.restoreAllMocks(); });
const esc = (d: HTMLDialogElement) => act(() => { d.dispatchEvent(new Event("cancel", { cancelable: true })); });

/** 말풍선·자동입력 창처럼 usePortalTarget 로 포털을 그리는 가상 팝업. */
function Popup() {
  const target = usePortalTarget();
  return target ? createPortal(h("div", { "data-popup": "" }, h("input", { "aria-label": "팝업 칸" })), target) : null;
}

describe("창 안 포털", () => {
  it("창 밖에서는 body, 열린 AppDialog 안에서는 그 dialog 안에 그린다", () => {
    act(() => root.render(h(Popup)));
    expect(document.querySelector("[data-popup]")!.parentElement).toBe(document.body);
    act(() => root.render(h(AppDialog, { title: "가상 창", onClose: vi.fn() }, h(Popup))));
    const dialog = document.querySelector("dialog")!;
    expect(dialog.querySelector("[data-popup]")).not.toBeNull();
    expect(document.body.querySelector(":scope > [data-popup]")).toBeNull();
  });

  it("초점이 창 안 포털 팝업에 있으면 Esc 가 바깥 창을 닫지 않는다(그 팝업 몫)", () => {
    const onClose = vi.fn();
    act(() => root.render(h(AppDialog, { title: "가상 창", onClose }, h("input", { "aria-label": "본판 칸" }), h(Popup))));
    const dialog = document.querySelector("dialog")!;
    act(() => (dialog.querySelector("[data-popup] input") as HTMLInputElement).focus());
    esc(dialog);
    expect(onClose).not.toHaveBeenCalled();
    act(() => (dialog.querySelector('[aria-label="본판 칸"]') as HTMLInputElement).focus());
    esc(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("DB정보 패널(DbDetail)", () => {
  const row = { ...blank(), company: "합성 회사", date: "2026-10-17" };
  const render = (onClose = vi.fn()) => {
    const noop = vi.fn();
    act(() => root.render(h(DbDetail, { row, draft: contactDraft(row), onChange: noop, onEdit: noop, onResult: noop, onRegister: noop, onOpen: noop, onClose, onDelete: noop, onAsInfo: noop })));
    return { dialog: document.querySelector("dialog")!, onClose };
  };

  it("모달 dialog 로 열리고 패널에 초점, 닫히면 연 버튼으로 초점 복귀", () => {
    const { dialog } = render();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-label")).toBe("DB정보");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog.querySelector(".db-detail-shell"));
    act(() => root.render(h("div")));
    expect(document.activeElement).toBe(trigger);
  });

  it("Esc = ✕ 와 같은 닫기", () => {
    const { dialog, onClose } = render();
    esc(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("어두운 바깥 누르기는 닫고, 패널 안에서 시작한 끌기는 닫지 않는다", () => {
    const { dialog, onClose } = render();
    const shell = dialog.querySelector(".db-detail-shell")!;
    act(() => { shell.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { shell.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { dialog.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("패널 안 포털 팝업(공급처 목록 등)은 dialog 안에 그려진다", () => {
    const { dialog } = render();
    const supplier = dialog.querySelector<HTMLInputElement>('[aria-label="DB정보 공급처"]')!;
    act(() => supplier.focus());
    expect(dialog.querySelector(".dbs-supplier-menu")).not.toBeNull();
  });
});

const backdrop = (d: HTMLDialogElement) => act(() => {
  d.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  d.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

describe("2차로 옮긴 창", () => {
  it("오류신고: 적던 설명이 있으면 Esc 가 묻고, 바깥 누르기로는 안 닫힌다", () => {
    const onClose = vi.fn();
    act(() => root.render(h(BugReportDialog, { capture: "", onClose })));
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector(".br-dialog"));
    backdrop(dialog);
    expect(onClose).not.toHaveBeenCalled();
    const text = dialog.querySelector("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(text, "가상 설명");
      text.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const ask = vi.spyOn(window, "confirm").mockReturnValue(false);
    esc(dialog);
    expect(ask).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    ask.mockReturnValue(true);
    esc(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("오류신고: 「캡처하러 가기」 동안 창이 빠졌다가 돌아오면 다시 모달로 열린다", () => {
    act(() => root.render(h(BugReportDialog, { capture: "", onClose: vi.fn() })));
    const go = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("화면 캡처하러 가기"))!;
    act(() => go.click());
    expect(document.querySelector("dialog")).toBeNull();
    act(() => (document.querySelector(".br-return") as HTMLButtonElement).click());
    expect(document.querySelector("dialog")!.open).toBe(true);
  });

  it("배지 보기: Esc·바깥 누르기로 닫히고 닫기 버튼에 초점", () => {
    const onClose = vi.fn();
    const def = BADGES[0]!;
    act(() => root.render(h(BadgeDetailSheet, { def, state: { id: def.id, earned: true, earnedOn: "2026-11-01", progress: null }, onClose })));
    const dialog = document.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBe("badge-sheet-title");
    expect(document.activeElement?.textContent).toBe("확인");
    esc(dialog);
    backdrop(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("이동 저장 결과: 안내 창 — 확인에 초점, Esc·바깥 누르기로 닫힘", () => {
    const onClose = vi.fn();
    const m = { inflow: 1, contactProgress: 1, meetingReservation: 0 } as never;
    act(() => root.render(h(RecordMoveReceipt, { receipt: { fromLabel: "가상 A", toLabel: "가상 B", from: m, to: m }, onClose })));
    const dialog = document.querySelector("dialog")!;
    expect(document.activeElement?.textContent).toBe("확인");
    esc(dialog);
    backdrop(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
