// @vitest-environment jsdom
/**
 * Scope A2 — weekly-goals pending-save behavior (genuine React DOM).
 *
 * Parent finding: every keystroke scheduled an 800ms debounce while inputs
 * sat disabled={status === "pending"}, so typing the first character locked
 * the user out. These tests drive the REAL WeeklyGoalEditor with a mocked
 * network layer and assert:
 *  ① multi-char typing while a save is pending never disables routine
 *    inputs (goal numbers, PT rows, draft tools, week nav);
 *  ② no hydration/refetch writes (silence until a real user edit);
 *  ③ edits typed while a save response is deferred are preserved
 *    (latest-wins) and sent after the flight;
 *  ④ 409 overwrite freezes the payload at click — the ACK marks only the
 *    frozen payload saved, later keystrokes stay unsent, newest CAS kept,
 *    and no automatic retry loop follows;
 *  ⑤ undo restores the displayed PT rows as well as the hook draft.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyGoalView } from "@/types/weekly-goals";
import WeeklyGoalEditor from "@/components/weekly-goals/WeeklyGoalEditor";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const NULL_GOALS = { production: null, inflow: null, contacts: null, meetings: null, contracts: null };

function makeView(): WeeklyGoalView {
  return {
    student: {
      email: "s@example.com",
      name: "학습자",
      cohort: "26-1",
      courseStart: "2026-09-04",
      region: "서울",
      trainers: [],
    },
    current: {
      week: 3,
      start: "2026-09-18",
      end: "2026-09-24",
      record: { goals: { ...NULL_GOALS }, task: "", revision: 7, updatedAt: null },
      actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    },
    previous: null,
    reporting: {
      start: "2026-09-18",
      end: "2026-09-24",
      actuals: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    },
    cumulative: { production: 0, inflow: 0, contacts: 0, meetings: 0, contracts: 0 },
    canReadInternal: false,
  };
}

interface Call {
  url: string;
  body: unknown;
}

const net = vi.hoisted(() => ({
  puts: [] as Call[],
  putGate: [] as Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }>,
  freshRevision: 99,
  failNextPutWith: null as unknown,
}));

vi.mock("@/components/weekly-goals/client", () => ({
  goalAccessDenied: () => false,
  goalParams: () => "mock-view-params",
  goalJSON: (url: string, body?: unknown) => {
    if (body === undefined) {
      // Overwrite's user-gated fresh read — newest server revision.
      return Promise.resolve({ current: { record: { revision: net.freshRevision } } });
    }
    net.puts.push({ url, body });
    return new Promise((resolve, reject) => {
      net.putGate.push({ resolve: resolve as (v: unknown) => void, reject });
    });
  },
}));

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function renderEditor() {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(
      h(WeeklyGoalEditor, {
        view: makeView(),
        changeWeek: () => {},
        reload: () => {},
      }),
    );
  });
}

const q = (sel: string): HTMLElement => {
  const node = el!.querySelector(sel);
  if (!node) throw new Error(`missing node: ${sel}`);
  return node as HTMLElement;
};
const taskRow1 = () => q('input[aria-label="이번 주 PT과제 1번"]') as HTMLInputElement;
const goalInput = () => q('input[aria-label="이번 목표 생산"]') as HTMLInputElement;

function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

/** Type char-by-char like a real user (each keystroke re-renders + reschedules). */
function typeChars(input: () => HTMLInputElement, full: string) {
  let cur = input().value;
  for (const ch of full.slice(cur.length)) {
    cur += ch;
    typeInto(input(), cur);
  }
}

async function micro(n = 30) {
  await act(async () => {
    for (let i = 0; i < n; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await micro();
}

function resolvePut(index: number, value: unknown) {
  act(() => {
    net.putGate[index]!.resolve(value);
  });
}

function rejectPut(index: number, err: unknown) {
  act(() => {
    net.putGate[index]!.reject(err);
  });
}

const conflictErr = () => Object.assign(new Error("conflict"), { status: 409 });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  net.puts.length = 0;
  net.putGate.length = 0;
  net.freshRevision = 99;
  net.failNextPutWith = null;
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("weekly-goals pending save never locks typing", () => {
  it("mount + timers send nothing (no hydration writes)", async () => {
    renderEditor();
    await advance(5000);
    expect(net.puts).toHaveLength(0);
  });

  it("multi-char typing with a pending save keeps every routine input enabled and saves latest-wins", async () => {
    renderEditor();
    await advance(5000);
    expect(net.puts).toHaveLength(0);

    // First character schedules the 800ms debounce…
    typeChars(taskRow1, "과");
    // …second/third characters arrive while pending: nothing may lock.
    typeChars(taskRow1, "과제정");
    expect(taskRow1().disabled).toBe(false);
    expect(goalInput().disabled).toBe(false);
    expect(q("fieldset").hasAttribute("disabled")).toBe(false);
    for (const btn of [...el!.querySelectorAll("button")]) {
      if (btn.textContent === "이전 주" || btn.textContent === "다음 주" || btn.textContent === "역산 제안") {
        expect(btn.disabled).toBe(false);
      }
    }
    expect(el!.textContent).toContain("저장 중…");

    await advance(800);
    expect(net.puts).toHaveLength(1);
    // Bound to the captured target (real params), not the mocked live view.
    expect(net.puts[0]!.url).toContain("week=3");
    expect((net.puts[0]!.body as { task: string }).task).toBe("과제정");

    // Edit while the save response is deferred — newer value must survive.
    typeChars(taskRow1, "과제정!");
    expect(taskRow1().value).toBe("과제정!");
    expect(taskRow1().disabled).toBe(false);
    resolvePut(0, { revision: 8 });
    await micro();
    // Latest-wins: the newer edit follows the flight.
    await advance(1200);
    expect(net.puts).toHaveLength(2);
    expect((net.puts[1]!.body as { task: string }).task).toBe("과제정!");
    expect((net.puts[1]!.body as { revision: number }).revision).toBe(8);
    resolvePut(1, { revision: 9 });
    await micro();
    await advance(2000);
    expect(net.puts).toHaveLength(2); // quiet after ACK — no loop
    expect(taskRow1().value).toBe("과제정!");
    expect(el!.textContent).toContain("저장됨");
  });
});

describe("409 conflict overwrite freezes the click-time payload", () => {
  it("ACK marks only the frozen payload saved; newer keystrokes stay unsent with the newest CAS", async () => {
    renderEditor();
    typeChars(taskRow1, "내입력");
    await advance(800);
    expect(net.puts).toHaveLength(1);
    rejectPut(0, conflictErr());
    await micro();
    expect(el!.textContent).toContain("내 입력으로 덮어쓰기");

    // Overwrite with the click-time payload frozen; keep typing mid-flight.
    const overwriteBtn = [...el!.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("내 입력으로 덮어쓰기"),
    )!;
    act(() => {
      overwriteBtn.click();
    });
    await micro();
    // GET fresh (revision 99) then PUT#2 with the frozen payload.
    expect(net.puts).toHaveLength(2);
    expect((net.puts[1]!.body as { task: string }).task).toBe("내입력");
    expect((net.puts[1]!.body as { revision: number }).revision).toBe(99);

    typeChars(taskRow1, "내입력+추가");
    resolvePut(1, { revision: 100 });
    await micro();
    // Displayed value is the newer edit — the ACK never claimed it saved.
    expect(taskRow1().value).toBe("내입력+추가");
    expect(el!.textContent).not.toContain("내 입력으로 덮어쓰기");

    // The newer edit autosaves once with the newest CAS, then silence.
    await advance(1200);
    expect(net.puts).toHaveLength(3);
    expect((net.puts[2]!.body as { task: string }).task).toBe("내입력+추가");
    expect((net.puts[2]!.body as { revision: number }).revision).toBe(100);
    resolvePut(2, { revision: 101 });
    await micro();
    await advance(5000);
    expect(net.puts).toHaveLength(3); // no automatic retry loop
  });

  it("overwrite with no newer edits sends once and stays quiet", async () => {
    renderEditor();
    typeChars(taskRow1, "고정값");
    await advance(800);
    rejectPut(0, conflictErr());
    await micro();
    const overwriteBtn = [...el!.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("내 입력으로 덮어쓰기"),
    )!;
    act(() => {
      overwriteBtn.click();
    });
    await micro();
    expect(net.puts).toHaveLength(2);
    resolvePut(1, { revision: 100 });
    await micro();
    await advance(5000);
    expect(net.puts).toHaveLength(2);
    expect(taskRow1().value).toBe("고정값");
  });
});

describe("undo restores the displayed PT rows", () => {
  it("clicking 되돌리기 updates the row inputs, not just the hook draft", async () => {
    renderEditor();
    typeChars(taskRow1, "첫입력");
    await advance(800);
    resolvePut(0, { revision: 8 });
    await micro();
    typeInto(taskRow1(), "두번째"); // full replacement, not an append
    await advance(800);
    expect(net.puts).toHaveLength(2);
    resolvePut(1, { revision: 9 });
    await micro();
    expect(taskRow1().value).toBe("두번째");

    const undoBtn = [...el!.querySelectorAll("button")].find((b) => b.textContent === "되돌리기");
    expect(undoBtn).toBeDefined();
    act(() => {
      undoBtn!.click();
    });
    await micro();
    // The separate taskRows state must follow the restored draft.
    expect(taskRow1().value).toBe("첫입력");

    // Undo is a compensating write of the pre-save snapshot.
    await advance(1200);
    expect(net.puts).toHaveLength(3);
    expect((net.puts[2]!.body as { task: string }).task).toBe("첫입력");
  });
});
