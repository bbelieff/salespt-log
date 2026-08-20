// @vitest-environment jsdom
/**
 * 담당 트레이너 토글 — 연타 유실 0·롤백 0 회귀 (BBE-253, BBE-243 패턴 재사용).
 *
 * 재현 기전(실측 근거):
 *  ① app/api/admin/assign-trainee 는 학생의 담당목록을 통째로 교체(delta 아님) — 두 요청이
 *     겹치면 서버 도착 순서에 따라 last-write-wins, 클라 발송 순서와 무관하게 유실 가능.
 *  ② TrainerAssignCard.toggle() 이 다음 상태를 t.assignedTrainer(서버 마지막 확정 prop, 연타
 *     중엔 stale)에서 계산 — 같은 학생을 거의 동시에 두 번 건드리면 두 번째가 stale 기준으로
 *     계산돼 첫 번째 변경을 덮어쓴다.
 *  ③ trainees prop 이 바뀔 때마다(=아무 학생의 저장 완료든) optimistic 표시를 통째로 지웠다 —
 *     아직 내 저장이 안 끝난 학생도 같이 지워져 "체크가 저절로 풀리는" 롤백 플래시가 났다.
 */
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import TrainerMgmtPanel from "@/components/auth/TrainerMgmtPanel";
import TrainerAssignCard from "@/components/auth/TrainerAssignCard";
import type { PanelUser } from "@/components/auth/TrainerMgmtSections";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function trainerUser(email: string, name: string): PanelUser {
  return { email, name, cohort: "", spreadsheetId: "", role: "trainer" };
}
function traineeUser(email: string, name: string, assignedTrainer = ""): PanelUser {
  return { email, name, cohort: "8", spreadsheetId: "s1", role: "trainee", assignedTrainer };
}

/** 응답을 테스트가 원하는 순서로 골라 resolve 할 수 있는 fetch — 네트워크 뒤섞임 재현용. */
function mockControllableFetch() {
  const calls: { body: Record<string, unknown>; resolve: () => void }[] = [];
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    return new Promise((resolve) => {
      calls.push({
        body: JSON.parse(String(init.body)),
        resolve: () =>
          resolve({ ok: true, status: 200, json: async () => ({ assigned: {} }) }),
      });
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function renderPanel(trainers: PanelUser[], trainees: PanelUser[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(TrainerMgmtPanel, {
        sessionEmail: "admin@test.com",
        pendingTrainers: [],
        activeTrainers: trainers,
        managementStaff: [],
        trainees,
      }),
    );
  });
  return host;
}

function openTrainerCard(host: HTMLElement, trainerName: string) {
  const header = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(trainerName),
  )!;
  click(header);
}

/** 트레이너 email 텍스트를 leaf div 로 찾아 그 카드 루트(.rounded-2xl)로 스코프 좁히기 —
 *  두 트레이너 카드 모두 같은 학생 email 텍스트를 담고 있어 카드별 격리가 필요하다. */
function findCard(host: HTMLElement, trainerEmail: string): HTMLElement {
  const emailNode = [...host.querySelectorAll("div")].find(
    (d) => d.children.length === 0 && d.textContent?.trim() === trainerEmail,
  )!;
  return emailNode.closest(".rounded-2xl") as HTMLElement;
}
function findCheckboxInCard(
  host: HTMLElement,
  trainerEmail: string,
  traineeEmail: string,
): HTMLInputElement {
  const card = findCard(host, trainerEmail);
  const label = [...card.querySelectorAll("label")].find((l) =>
    l.textContent?.includes(traineeEmail),
  )!;
  return label.querySelector('input[type="checkbox"]')!;
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("담당 트레이너 토글 — 좌표(coalesce) (BBE-253)", () => {
  it("★같은 학생 체크박스 7연타 — 실행은 좌표되고(≤2회) 마지막 클릭 의도가 서버로 간다", async () => {
    const { calls } = mockControllableFetch();
    const t1 = trainerUser("t1@test.com", "트레이너1");
    const s1 = traineeUser("s1@test.com", "학생1");
    const host = renderPanel([t1], [s1]);
    openTrainerCard(host, "트레이너1");
    const box = findCheckboxInCard(host, "t1@test.com", "s1@test.com");
    expect(box.checked).toBe(false);

    // 7회(홀수) 연타 — 미배정(false) 에서 시작해 마지막은 배정(true) 로 끝난다.
    await act(async () => {
      for (let i = 0; i < 7; i++) box.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // run() 자체는 "즉시 1 + 큐의 마지막 1" 수준으로만 실행됨(BBE-243 좌표 계약 재사용).
    expect(calls.length).toBeLessThanOrEqual(2);
    const lastCall = calls.at(-1)!;
    expect((lastCall.body.trainerEmails as string[]) ?? []).toContain("t1@test.com");

    await act(async () => {
      for (const c of calls) c.resolve();
      await Promise.resolve();
    });
    expect(box.checked).toBe(true); // 마지막(7번째, 홀수) 클릭 의도 = 체크 상태로 최종 수렴
  });

  it("★서로 다른 트레이너 카드에서 같은 학생을 거의 동시에 체크해도 둘 다 반영된다(stale 기준 덮어쓰기 방지)", async () => {
    const { calls } = mockControllableFetch();
    const t1 = trainerUser("t1@test.com", "트레이너1");
    const t2 = trainerUser("t2@test.com", "트레이너2");
    const s1 = traineeUser("s1@test.com", "학생1");
    const host = renderPanel([t1, t2], [s1]);
    openTrainerCard(host, "트레이너1");
    openTrainerCard(host, "트레이너2");
    const box1 = findCheckboxInCard(host, "t1@test.com", "s1@test.com");
    const box2 = findCheckboxInCard(host, "t2@test.com", "s1@test.com");

    // 응답이 하나도 안 온 상태에서 t1 체크 → 곧이어 t2 체크 (같은 학생, 다른 카드).
    await act(async () => {
      click(box1);
    });
    await act(async () => {
      click(box2);
    });

    // t1 트리거는 즉시 실행(1건), t2 트리거는 같은 학생 키라 좌표 큐에 대기 중이어야 한다.
    expect(calls.length).toBe(1);
    // 대기 중인 t2 트리거를 이어서 실행시키려면 첫 실행을 완료시켜야 한다.
    await act(async () => {
      calls[0]!.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 좌표 큐가 이어서 실행한 마지막 요청 — resolveAssigned 가 t1 의 추가를 stale 하게 잃지
    // 않고 t2 계산의 기준(current)에 반영했어야 t1·t2 둘 다 최종 목록에 남는다.
    const finalCall = calls.at(-1)!;
    const finalList = (finalCall.body.trainerEmails as string[]) ?? [];
    expect(finalList).toContain("t1@test.com");
    expect(finalList).toContain("t2@test.com");
  });
});

describe("TrainerAssignCard optimistic 표시 — 무관한 학생 갱신이 내 체크를 되돌리지 않는다 (BBE-253)", () => {
  it("s2 의 서버반영이 먼저 도착해도, 아직 서버 미반영인 s1 의 체크는 유지된다(롤백 플래시 방지)", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const t1 = trainerUser("t1@test.com", "트레이너1");
    let trainees = [traineeUser("s1@test.com", "학생1"), traineeUser("s2@test.com", "학생2")];
    const onSave = vi.fn();
    const resolveAssigned = (_email: string, fallback: string[]) => fallback;

    function render() {
      act(() => {
        root.render(
          createElement(TrainerAssignCard, {
            trainer: t1,
            trainees,
            busy: null,
            onSave,
            resolveAssigned,
          }),
        );
      });
    }
    render();
    const openBtn = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("트레이너1"),
    )!;
    click(openBtn);

    const findBox = (email: string) => {
      const label = [...host.querySelectorAll("label")].find((l) =>
        l.textContent?.includes(email),
      )!;
      return label.querySelector('input[type="checkbox"]')! as HTMLInputElement;
    };

    click(findBox("s1@test.com")); // s1 optimistic=true, 저장 응답 아직 없음(이 테스트는 network 무관)
    click(findBox("s2@test.com")); // s2 optimistic=true
    expect(findBox("s1@test.com").checked).toBe(true);
    expect(findBox("s2@test.com").checked).toBe(true);

    // "서버가 s2 만 먼저 반영" 시뮬레이션 — 새 trainees prop: s2 만 갱신, s1 은 여전히 미반영.
    trainees = [
      traineeUser("s1@test.com", "학생1"), // 그대로 — 아직 서버 미반영
      traineeUser("s2@test.com", "학생2", "t1@test.com"), // 서버 반영됨
    ];
    render();

    expect(findBox("s2@test.com").checked).toBe(true); // 이미 props 자체가 checked
    // ★핵심: s1 은 optimistic 이 아직 지워지지 않아야 한다 — 지워지면 서버의 옛(미반영) 값인
    // false 로 되돌아가 체크가 저절로 풀리는 것처럼 보인다(belie 가 본 증상).
    expect(findBox("s1@test.com").checked).toBe(true);
  });
});
