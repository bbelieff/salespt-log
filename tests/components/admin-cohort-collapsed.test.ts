// @vitest-environment jsdom
/**
 * 수강생관리 기수·팀 박스 기본 접힘(2026-11-03, admin-users-collapsed-default).
 *  ① collapsed → 저장된 펼침 상태가 없으면 기수·팀 박스 모두 닫힘.
 *  ② collapsed 없음(트레이너 화면) → 예전처럼 펼침.
 *  ③ 사용자가 펼쳐 둔 기수는 다시 들어와도 펼침(저장 키 v2).
 *  ④ 검색 중(forceOpen) → 접힌 박스도 펼쳐 결과를 보여 주고, 기억은 바꾸지 않음.
 * 합성 수강생만(실제 개인정보 없음).
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CohortSection, type Trainee } from "@/components/auth/AdminUserPickerSections";

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
  it("collapsed → 기수·팀 박스 모두 닫힘", () => {
    expect(render(true)).toEqual([false, false]);
  });
  it("collapsed 없음(트레이너 화면) → 펼침 유지", () => {
    expect(render()).toEqual([true, true]);
  });
  it("펼쳐 둔 기수는 저장값대로 펼침", () => {
    window.localStorage.setItem("salespt:admin:collapsed:v2", JSON.stringify({ "cohort:99": true }));
    expect(render(true)).toEqual([true, false]);
  });
  it("검색 중 → 기수·팀 모두 펼침, 저장값은 그대로", () => {
    expect(render(true, true)).toEqual([true, true]);
    expect(window.localStorage.getItem("salespt:admin:collapsed:v2")).toBeNull();
  });
});
