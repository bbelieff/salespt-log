// @vitest-environment jsdom
// createElement 기반이라 기본 Vitest 수집 패턴(`*.test.ts`)을 그대로 사용한다.
import * as React from "react";
import { act, createElement, useState } from "react";
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

import TodoFormModal, {
  type TodoDraftSeed,
} from "@/app/(app)/payment/_components/TodoFormModal";

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

function renderModal(onClose = vi.fn()) {
  host = document.createElement("div");
  host.dataset.testHost = "payment-page";
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      createElement(TodoFormModal, {
        contractRef: "contract-1",
        institutionRef: "기관 1",
        companyName: "테스트 업체",
        initial: seed,
        onClose,
      }),
    );
  });

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  const overlay = dialog?.parentElement as HTMLElement | null;
  return { dialog, onClose, overlay };
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  mocks.guardedNav.mockClear();
  mocks.mutateAsync.mockClear();
  mocks.registerDirty.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  host = null;
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("payment Todo/History 상세 모달 레이어", () => {
  it("document.body portal에서 전체 viewport backdrop과 선명한 dialog를 분리한다", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { dialog, overlay } = renderModal();

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.parentElement).toBe(document.body);
    expect(host?.childElementCount).toBe(0);
    expect(overlay?.className).toContain("fixed inset-0");
    expect(overlay?.className).toContain("z-[300]");
    expect(overlay?.className).toContain("backdrop-blur-[2px]");
    expect(document.activeElement).toBe(dialog);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("panel과 Todo/History 탭 클릭은 닫히지 않고 backdrop 클릭만 guarded close를 탄다", () => {
    const backgroundNav = document.createElement("button");
    const backgroundClick = vi.fn();
    backgroundNav.addEventListener("click", backgroundClick);
    document.body.append(backgroundNav);

    const { dialog, onClose, overlay } = renderModal();
    const history = [...dialog!.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("History"),
    )!;

    click(history);
    expect(history.className).toContain("bg-white");
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.guardedNav).not.toHaveBeenCalled();

    click(dialog!);
    expect(onClose).not.toHaveBeenCalled();
    expect(backgroundClick).not.toHaveBeenCalled();

    click(overlay!);
    expect(mocks.guardedNav).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backgroundClick).not.toHaveBeenCalled();
  });

  it("Escape close 뒤 opener focus와 기존 body overflow를 정확히 복원한다", () => {
    document.body.style.overflow = "clip";
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement(
        React.Fragment,
        null,
        createElement("button", { type: "button", onClick: () => setOpen(true) }, "상세 열기"),
        open
          ? createElement(TodoFormModal, {
              contractRef: "contract-1",
              institutionRef: "기관 1",
              companyName: "테스트 업체",
              initial: seed,
              onClose: () => setOpen(false),
            })
          : null,
      );
    }

    act(() => root?.render(createElement(Harness)));
    const opener = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "상세 열기",
    )!;
    opener.focus();
    click(opener);

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement?.getAttribute("role")).toBe("dialog");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(mocks.guardedNav).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.activeElement).toBe(opener);
  });
});
