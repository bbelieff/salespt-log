// @vitest-environment jsdom
/**
 * 수강생관리 기수·팀 박스 기본 접힘(2026-11-03, admin-users-collapsed-default).
 *  ① collapsed → 저장된 펼침 상태가 없으면 기수 박스는 닫힘, 안의 팀 박스는 펼침(기수를 열면 팀이 바로 보임).
 *  ② collapsed 를 안 주면 → 펼침(CohortSection 기본값. 트레이너 화면도 2026-11-12부터 collapsed 를 준다).
 *  ③ 사용자가 펼쳐 둔 기수는 다시 들어와도 펼침(저장 키 v2).
 *  ⑤ PC 3기수 나란히 — 격자 3열 고정, 펼쳐도 한 줄 전체를 차지하지 않음.
 *  ④ 검색 중(forceOpen) → 접힌 박스도 펼쳐 결과를 보여 주고, 기억은 바꾸지 않음.
 * 합성 수강생만(실제 개인정보 없음).
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { COHORT_GRID, CohortSection, type Trainee } from "@/components/auth/AdminUserPickerSections";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const list: Trainee[] = [
  { email: "a@example.test", cohort: "99", name: "가상일", spreadsheetId: "", role: "trainee", team: "" },
  { email: "b@example.test", cohort: "99", name: "가상이", spreadsheetId: "", role: "trainee", team: "서울" },
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  window.localStorage.clear();
});

function render(collapsed?: boolean, forceOpen?: boolean) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      h(CohortSection, {
        cohort: "99",
        list,
        busy: null,
        nameByEmail: new Map(),
        onPick: () => {},
        onReserve: () => {},
        onSetTeam: () => {},
        viewOnly: true,
        collapsed,
        forceOpen,
      }),
    );
  });
  return [...host.querySelectorAll("details")].map((d) => d.open);
}

describe("CohortSection 기본 접힘", () => {
  it("collapsed → 기수는 닫힘, 팀은 펼침", () => {
    expect(render(true)).toEqual([false, true]);
  });
  it("collapsed 없음(기본값) → 펼침 유지", () => {
    expect(render()).toEqual([true, true]);
  });
  it("펼쳐 둔 기수는 저장값대로 펼침, 사용자가 접은 팀은 접힘 유지", () => {
    window.localStorage.setItem("salespt:admin:collapsed:v2", JSON.stringify({ "cohort:99": true, "team:99:서울": false }));
    expect(render(true)).toEqual([true, false]);
  });
  it("검색 중 → 기수·팀 모두 펼침, 저장값은 그대로", () => {
    expect(render(true, true)).toEqual([true, true]);
    expect(window.localStorage.getItem("salespt:admin:collapsed:v2")).toBeNull();
  });
  it("PC 3열 고정 — 펼친 기수도 자기 칸 유지", () => {
    expect(COHORT_GRID).toContain("pc:grid-cols-3");
    render(true, true);
    expect(host!.querySelector("details")!.className).not.toContain("col-span");
  });
});
