// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardedNav: vi.fn((action: () => void) => action()),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  registerDirty: vi.fn(),
}));

vi.mock("@/components/DirtyGuard", () => ({
  useDirtyEntry: mocks.registerDirty,
  useGuardedNav: () => mocks.guardedNav,
}));

vi.mock("@/query/todos-hooks", () => ({
  newTodoOperationId: () => "todo-op-test",
  useCreateTodo: () => ({ isPending: false, mutateAsync: mocks.mutateAsync }),
}));

import TodoFormModal, { type TodoDraftSeed } from "@/app/(app)/payment/_components/TodoFormModal";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const seed: TodoDraftSeed = {
  기록종류: "todo",
  제목: "후속 연락",
  예정일자: "2026-10-02",
  hour: "10",
  minute: "15",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mountModal(onClose = vi.fn()) {
  host = document.createElement("div");
  host.dataset.testHost = "payment-page";
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(h(TodoFormModal, {
      contractRef: "contract-1",
      institutionRef: "기관 1",
      companyName: "테스트 업체",
      initial: seed,
      onClose,
    }));
  });
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  return { dialog, onClose, overlay: dialog?.parentElement as HTMLElement | null };
}

function click(target: Element) {
  act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  mocks.guardedNav.mockClear();
  mocks.mutateAsync.mockClear();
  mocks.registerDirty.mockClear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host = null;
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("payment Todo/History 상세 모달", () => {
  it("document.body portal의 full-viewport backdrop과 선명한 dialog를 분리한다", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { dialog, overlay } = mountModal();

    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Todo 상세");
    expect(overlay?.parentElement).toBe(document.body);
    expect(host?.childElementCount).toBe(0);
    expect(overlay?.className).toContain("fixed inset-0");
    expect(overlay?.className).toContain("backdrop-blur-[2px]");
    expect(dialog?.className).not.toContain("backdrop-blur");
    expect(document.activeElement).toBe(dialog);
  });

  it("열릴 때 body scroll을 잠그고 unmount에서 기존 inline overflow와 opener focus를 복원한다", () => {
    document.body.style.overflow = "clip";
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    function Harness() {
      const [open, setOpen] = useState(false);
      return h(React.Fragment, null,
        h("button", { type: "button", onClick: () => setOpen(true) }, "상세 열기"),
        open ? h(TodoFormModal, {
          contractRef: "contract-1",
          institutionRef: "기관 1",
          companyName: "테스트 업체",
          initial: seed,
          onClose: () => setOpen(false),
        }) : null,
      );
    }

    act(() => root?.render(h(Harness)));
    const opener = host.querySelector("button")!;
    opener.focus();
    click(opener);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");

    click(document.querySelector('[aria-label="닫기"]')!);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.activeElement).toBe(opener);
  });

  it("panel과 Todo/History 탭은 닫거나 배경을 누르지 않고 backdrop만 guarded close를 탄다", () => {
    const background = document.createElement("button");
    const backgroundClick = vi.fn();
    background.addEventListener("click", backgroundClick);
    document.body.append(background);
    const { dialog, onClose, overlay } = mountModal();
    const historyTab = [...dialog!.querySelectorAll("button")].find((button) => button.textContent?.includes("History"))!;

    click(historyTab);
    expect(historyTab.className).toContain("bg-white");
    click(dialog!);
    expect(mocks.guardedNav).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(backgroundClick).not.toHaveBeenCalled();

    click(overlay!);
    expect(mocks.guardedNav).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backgroundClick).not.toHaveBeenCalled();
  });

  it("Escape가 guarded close를 호출한다", () => {
    const { onClose } = mountModal();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(mocks.guardedNav).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
