// @vitest-environment jsdom
/**
 * 퇴출된 트레이너는 담당에서 빠진다(2026-11-03, belie 「퇴출되어서 이메일로 표기되는데 퇴출시 자동으로 담당에서도 나가지게」).
 *  ① 활성 트레이너 풀에 없는 담당 email 은 표시하지 않는다.
 *  ② 담당을 바꿔 저장하면 퇴출 잔재도 함께 빠진다(손댄 수강생만, 일괄 재작성 없음).
 *  ③ 풀을 모르면(activeTrainers 없음) 거르지 않는다.
 * 합성 email 만.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (p: React.ComponentProps<"a">) => h("a", p) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/query/me-hook", () => ({ useMe: () => ({ data: undefined }) }));

import TraineeCard from "@/components/auth/TraineeCard";
import type { Trainee } from "@/components/auth/AdminUserPickerTypes";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ACTIVE = "active@example.test";
const RETIRED = "retired@example.test";
const u: Trainee = {
  email: "student@example.test", cohort: "99", name: "가상", spreadsheetId: "s1",
  role: "trainee", assignedTrainer: `${ACTIVE},${RETIRED}`, team: "",
};
const names = new Map([[ACTIVE, "활성가상"]]);

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(extra: Record<string, unknown>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(h(TraineeCard, {
      u, archived: false, viewOnly: false, busy: null, nameByEmail: names,
      onPick: () => {}, onReserve: () => {}, onSetTeam: () => {}, ...extra,
    }));
  });
  return host;
}

describe("TraineeCard — 퇴출 트레이너", () => {
  it("활성 풀에 없는 담당은 표시 안 함", () => {
    const el = render({ activeTrainers: [{ email: ACTIVE, name: "활성가상" }], onAssignTrainers: () => {} });
    expect(el.textContent).toContain("활성가상");
    expect(el.textContent).not.toContain(RETIRED);
  });
  it("담당을 바꿔 저장하면 퇴출 잔재도 빠짐", () => {
    const saved: string[][] = [];
    const el = render({
      activeTrainers: [{ email: ACTIVE, name: "활성가상" }, { email: "new@example.test", name: "새가상" }],
      onAssignTrainers: (_: string, next: string[]) => saved.push(next),
    });
    act(() => (el.querySelector('button[aria-expanded]') as HTMLButtonElement).click());
    const chip = [...el.querySelectorAll("button")].find((b) => b.getAttribute("title") === "new@example.test")!;
    act(() => chip.click());
    expect(saved).toEqual([[ACTIVE, "new@example.test"]]);
  });
  it("풀을 모르면 거르지 않음", () => {
    expect(render({}).textContent).toContain(RETIRED);
  });
});
