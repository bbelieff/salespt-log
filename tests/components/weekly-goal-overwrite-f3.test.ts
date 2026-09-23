// @vitest-environment jsdom
/**
 * Scope F3 — final core/weekly conflict integration (genuine React DOM).
 *
 * Covers what A2 left on the F-core contract:
 *  ① 409 → overwrite unchanged succeeds: old transport error clears, saved
 *     baseline becomes exactly the frozen payload, then quiet (no retry);
 *  ② newest draft typed during a deferred overwrite is preserved, is NOT
 *     PUT before the overwrite ACK (no simultaneous direct + autosave PUT),
 *     then commits serialized as exactly the latest payload + new revision;
 *  ③ refetch alone never reports Saved and never clobbers a dirty draft;
 *  ④ overwrite failure retains the CURRENT draft (text typed while waiting
 *     is not clobbered by the click-time closure) and stays retryable.
 * Both goal editors (public WeeklyGoalEditor + GoalInternalEditor) run the
 * same frozen-overwrite path through the shared hook/queue acknowledge().
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyGoalView } from "@/types/weekly-goals";
import WeeklyGoalEditor from "@/components/weekly-goals/WeeklyGoalEditor";
import GoalInternalEditor from "@/components/weekly-goals/GoalInternalEditor";

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
  freshInternalRevision: 50,
  internalGets: 0,
}));

vi.mock("@/components/weekly-goals/client", () => ({
  goalAccessDenied: () => false,
  goalParams: () => "mock-view-params",
  goalJSON: (url: string, body?: unknown) => {
    if (body === undefined) {
      if (url.includes("/internal")) {
        // First GET is the initial load (revision 5); later GETs are the
        // overwrite's user-gated fresh reads (newest server revision).
        const revision = net.internalGets === 0 ? 5 : net.freshInternalRevision;
        net.internalGets++;
        return Promise.resolve({
          specialNotes: "",
          priorOutcome: "",
          revision,
          updatedAt: null,
        });
      }
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

function renderPublic(view?: WeeklyGoalView) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(
      h(WeeklyGoalEditor, { view: view ?? makeView(), changeWeek: () => {}, reload: () => {} }),
    );
  });
}

function renderInternal() {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(h(GoalInternalEditor, { view: makeView(), onDirty: () => {}, onRecord: () => {} }));
  });
}

function rerenderPublic(view: WeeklyGoalView) {
  act(() => {
    root?.render(h(WeeklyGoalEditor, { view, changeWeek: () => {}, reload: () => {} }));
  });
}

const q = (sel: string): HTMLElement => {
  const node = el!.querySelector(sel);
  if (!node) throw new Error(`missing node: ${sel}`);
  return node as HTMLElement;
};
const taskRow1 = () => q('input[aria-label="이번 주 PT과제 1번"]') as HTMLInputElement;
const notesArea = () => q('textarea[aria-label="트레이닝 후 특이사항"]') as HTMLTextAreaElement;
const overwriteBtn = () => {
  const btn = [...el!.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("내 입력으로 덮어쓰기"),
  );
  if (!btn) throw new Error("missing overwrite button");
  return btn as HTMLButtonElement;
};

function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

function typeChars(input: () => HTMLInputElement, full: string) {
  let cur = input().value;
  for (const ch of full.slice(cur.length)) {
    cur += ch;
    typeInto(input(), cur);
  }
}

function typeIntoArea(area: HTMLTextAreaElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(area, text);
    area.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

function typeAreaChars(area: () => HTMLTextAreaElement, full: string) {
  let cur = area().value;
  for (const ch of full.slice(cur.length)) {
    cur += ch;
    typeIntoArea(area(), cur);
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
  net.freshInternalRevision = 50;
  net.internalGets = 0;
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("public overwrite ACK clears the old error and stays quiet", () => {
  it("409 -> overwrite unchanged succeeds with the frozen payload + fresh revision", async () => {
    renderPublic();
    typeChars(taskRow1, "내입력");
    await advance(800);
    expect(net.puts).toHaveLength(1);
    rejectPut(0, conflictErr());
    await micro();
    expect(el!.textContent).toContain("내 입력으로 덮어쓰기");

    act(() => {
      overwriteBtn().click();
    });
    await micro();
    expect(net.puts).toHaveLength(2);
    expect((net.puts[1]!.body as { task: string }).task).toBe("내입력");
    expect((net.puts[1]!.body as { revision: number }).revision).toBe(99);
    expect(net.puts[1]!.url).toContain("week=3");

    // Overwrite in flight: no simultaneous autosave PUT.
    await advance(2000);
    expect(net.puts).toHaveLength(2);

    resolvePut(1, { revision: 100 });
    await micro();
    // Successful overwrite clears the old transport error and the conflict.
    expect(el!.textContent).not.toContain("내 입력으로 덮어쓰기");
    expect(taskRow1().value).toBe("내입력");
    expect(el!.textContent).toContain("저장됨");
    await advance(5000);
    expect(net.puts).toHaveLength(2);
  });
});

describe("newest draft during a deferred overwrite is preserved, then serialized", () => {
  it("public: nothing PUT before the overwrite ACK, then exactly the latest + new revision", async () => {
    renderPublic();
    typeChars(taskRow1, "내입력");
    await advance(800);
    expect(net.puts).toHaveLength(1);
    rejectPut(0, conflictErr());
    await micro();

    act(() => {
      overwriteBtn().click();
    });
    await micro();
    expect(net.puts).toHaveLength(2);
    expect((net.puts[1]!.body as { task: string }).task).toBe("내입력");

    // New typing while the overwrite is deferred: editable, staged, unsent.
    typeChars(taskRow1, "내입력+추가");
    expect(taskRow1().value).toBe("내입력+추가");
    expect(taskRow1().disabled).toBe(false);
    await advance(2000);
    expect(net.puts).toHaveLength(2); // never PUT before the ACK

    resolvePut(1, { revision: 100 });
    await micro();
    // The ACK claims only the frozen payload — the newer draft is untouched.
    expect(taskRow1().value).toBe("내입력+추가");

    await advance(1200);
    expect(net.puts).toHaveLength(3);
    expect((net.puts[2]!.body as { task: string }).task).toBe("내입력+추가");
    expect((net.puts[2]!.body as { revision: number }).revision).toBe(100);
    resolvePut(2, { revision: 101 });
    await micro();
    await advance(5000);
    expect(net.puts).toHaveLength(3);
    expect(el!.textContent).toContain("저장됨");
  });

  it("internal: deferred keystrokes commit after the ACK with the newest CAS", async () => {
    renderInternal();
    await micro();
    await advance(1000);
    expect(net.puts).toHaveLength(0); // load is GET-only
    typeAreaChars(notesArea, "내부메모");
    await advance(800);
    expect(net.puts).toHaveLength(1);
    expect((net.puts[0]!.body as { specialNotes: string }).specialNotes).toBe("내부메모");
    expect((net.puts[0]!.body as { revision: number }).revision).toBe(5);
    rejectPut(0, conflictErr());
    await micro();
    expect(el!.textContent).toContain("내 입력으로 덮어쓰기");

    act(() => {
      overwriteBtn().click();
    });
    await micro();
    expect(net.puts).toHaveLength(2);
    expect((net.puts[1]!.body as { specialNotes: string }).specialNotes).toBe("내부메모");
    expect((net.puts[1]!.body as { revision: number }).revision).toBe(50);

    typeAreaChars(notesArea, "내부메모+추가");
    await advance(2000);
    expect(net.puts).toHaveLength(2);

    resolvePut(1, { revision: 60 });
    await micro();
    expect(notesArea().value).toBe("내부메모+추가");
    expect(el!.textContent).not.toContain("내 입력으로 덮어쓰기");

    await advance(1200);
    expect(net.puts).toHaveLength(3);
    expect((net.puts[2]!.body as { specialNotes: string }).specialNotes).toBe("내부메모+추가");
    expect((net.puts[2]!.body as { revision: number }).revision).toBe(60);
    resolvePut(2, { revision: 61 });
    await micro();
    await advance(5000);
    expect(net.puts).toHaveLength(3);
  });
});

describe("refetch alone never reports Saved", () => {
  it("mount silence plus a dirty server refresh preserves the draft without claiming saved", async () => {
    renderPublic();
    await advance(5000);
    expect(net.puts).toHaveLength(0);
    expect(el!.textContent).not.toContain("저장됨");

    typeChars(taskRow1, "초안");
    // Server refresh arrives while the draft is unsent.
    const base = makeView();
    rerenderPublic({
      ...base,
      current: {
        ...base.current,
        record: { ...base.current.record, task: "서버최신", revision: 8 },
      },
    });
    await micro();
    expect(taskRow1().value).toBe("초안"); // dirty draft preserved
    expect(net.puts).toHaveLength(0);
    expect(el!.textContent).not.toContain("저장됨"); // refetch never reports Saved

    await advance(800);
    expect(net.puts).toHaveLength(1);
    expect((net.puts[0]!.body as { task: string }).task).toBe("초안");
    resolvePut(0, { revision: 9 });
    await micro();
    expect(el!.textContent).toContain("저장됨"); // saved only via the real ACK
  });
});

describe("overwrite failure retains the CURRENT draft", () => {
  it("text typed while waiting survives the failed overwrite and stays retryable", async () => {
    renderPublic();
    typeChars(taskRow1, "내입력");
    await advance(800);
    expect(net.puts).toHaveLength(1);
    rejectPut(0, conflictErr());
    await micro();

    act(() => {
      overwriteBtn().click();
    });
    await micro();
    expect(net.puts).toHaveLength(2);

    typeChars(taskRow1, "내입력+추가");
    rejectPut(1, new Error("overwrite failed"));
    await micro();
    // The click-time closure must not clobber text typed while waiting.
    expect(taskRow1().value).toBe("내입력+추가");
    expect(el!.textContent).toContain("내 입력으로 덮어쓰기");
    await advance(3000);
    expect(net.puts).toHaveLength(2); // no automatic retry loop

    // Retry with the CURRENT draft succeeds and clears everything.
    act(() => {
      overwriteBtn().click();
    });
    await micro();
    expect(net.puts).toHaveLength(3);
    expect((net.puts[2]!.body as { task: string }).task).toBe("내입력+추가");
    resolvePut(2, { revision: 100 });
    await micro();
    expect(taskRow1().value).toBe("내입력+추가");
    expect(el!.textContent).not.toContain("내 입력으로 덮어쓰기");
    expect(el!.textContent).not.toContain("overwrite failed");
    await advance(5000);
    expect(net.puts).toHaveLength(3);
  });
});
