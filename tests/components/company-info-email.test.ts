// @vitest-environment jsdom
/**
 * 업체정보 [대표자] 이메일 칸 (company-info-email 2026-10). 합성 값(example.com)만.
 * 하네스 = company-finance-grid.test.ts 와 같음: useAutosave 를 흉내 내 draft 는 처음 값에 고정 —
 * 그래서 blur 정리는 "처음 값이 이미 들어 있는 칸"으로 확인하고, 그대로 저장되는지는 typeInto 로 따로 본다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import { companyInfoFieldList, 기업정보_ITEMS, 대표자_ITEMS, 재무_ITEMS } from "@/components/company-info-defs";
import { countFields } from "@/components/company-info/view-filter";
import { EMAIL_SHAPE_MSG } from "@/components/company-info/CompanyInfoField";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const stage = vi.fn();
vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { initial: unknown }) => ({
    draft: opts.initial,
    saved: opts.initial,
    status: "idle",
    error: "",
    dirty: false,
    savedAt: null,
    canUndo: false,
    update: vi.fn(),
    stage: (...a: unknown[]) => stage(...a),
    commit: vi.fn(),
    syncServer: vi.fn(),
    retry: vi.fn(),
    flush: vi.fn(),
    undo: vi.fn(),
  }),
}));

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function render(value: Partial<CompanyInfo> = {}, defaultLayout: "basic" | "extended" = "extended") {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(h(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave: () => undefined, hideSave: true, defaultLayout }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  stage.mockReset();
  localStorage.clear();
});

const groupEl = (name: string) => el!.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`)!;
const byKey = (scope: HTMLElement, key: string) => scope.querySelector<HTMLInputElement>(`[id$="-${key}"]`);
const staged = () => stage.mock.calls.at(-1)![0] as CompanyInfo;
const notices = () => [...el!.querySelectorAll('[role="status"]')].map((n) => n.textContent);

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const focus = (input: HTMLInputElement) => act(() => input.focus());
const blur = (input: HTMLInputElement) => act(() => input.blur());

describe("배치 — [대표자] 연락처 줄 바로 아래 전폭", () => {
  it("정의 순서: 신용점수|연락처 다음 항목이 이메일(전폭 span 2)", () => {
    const pairAt = 대표자_ITEMS.findIndex((it) => it.kind === "pair" && it.defs.some((d) => d[0] === "연락처통신사"));
    const next = 대표자_ITEMS[pairAt + 1]!;
    expect(next.kind === "field" && next.def[0]).toBe("이메일");
    expect(next.kind === "field" && next.def[3]).toBe(2);
  });

  it("빈 업체(적은 것 위로 올리기 영향 없음) 화면에서도 연락처 다음 입력칸이 이메일, 2열 그리드 전폭", () => {
    render();
    const ids = [...groupEl("대표자").querySelectorAll("input, select, textarea")]
      .map((x) => x.id.split("-").at(-1))
      .filter((k) => k && !k.startsWith(":"));
    expect(ids[ids.indexOf("연락처통신사") + 1]).toBe("이메일");
    const email = byKey(groupEl("대표자"), "이메일")!;
    expect(email.parentElement!.className).toContain("sm:col-span-2");
    expect(el!.querySelector(`label[for="${email.id}"]`)?.textContent).toBe("이메일");
  });

  it("기본보기에는 이메일 칸이 없고, 이메일만 적혀 있으면 「확장보기에 적힌 항목 1개」", () => {
    render({ 이메일: "ceo@example.com" }, "basic");
    expect(el!.querySelector('[id$="-이메일"]')).toBeNull();
    expect(el!.textContent).toContain("확장보기에 적힌 항목 1개 더 있어요");
  });
});

describe("입력 — 정리·막지 않는 모양 안내", () => {
  it("모바일 @ 키보드·자동완성 끔·첫 글자 대문자/맞춤법 끔, type 은 text", () => {
    render();
    const email = byKey(groupEl("대표자"), "이메일")!;
    expect(email.type).toBe("text");
    expect(email.getAttribute("inputmode")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("off");
    expect(email.getAttribute("autocapitalize")).toBe("none");
    expect(email.getAttribute("spellcheck")).toBe("false");
  });

  it("칸을 벗어나면 공백·전각 ＠ 를 정리해 저장(대소문자 그대로)", () => {
    render({ 이메일: " CEO＠Example.com " });
    const email = byKey(groupEl("대표자"), "이메일")!;
    focus(email);
    blur(email);
    expect(staged().이메일).toBe("CEO@Example.com");
  });

  it("모양이 아니어도 적은 그대로 저장된다(막지 않음)", () => {
    render();
    typeInto(byKey(groupEl("대표자"), "이메일")!, "ceo@example");
    expect(staged().이메일).toBe("ceo@example");
  });

  it("불러온 값이 모양이 아니면 amber 안내(role=status) — 적는 동안은 감추고 벗어나면 다시, 정리할 게 없으면 저장 안 함", () => {
    render({ 이메일: "ceo@example" });
    const email = byKey(groupEl("대표자"), "이메일")!;
    expect(notices()).toContain(EMAIL_SHAPE_MSG);
    const notice = [...el!.querySelectorAll('[role="status"]')].find((n) => n.textContent === EMAIL_SHAPE_MSG)!;
    expect(notice.className).toContain("text-amber-700");
    focus(email);
    expect(notices()).not.toContain(EMAIL_SHAPE_MSG);
    blur(email);
    expect(notices()).toContain(EMAIL_SHAPE_MSG);
    expect(stage).not.toHaveBeenCalled();
  });

  it("맞는 모양·여러 주소·빈 값이면 안내 없음", () => {
    for (const v of ["ceo@example.com", "a@example.com, b@example.co.kr", ""]) {
      render({ 이메일: v });
      expect(notices(), v).not.toContain(EMAIL_SHAPE_MSG);
      act(() => root?.unmount());
      el?.remove();
    }
    root = undefined;
    el = undefined;
  });
});

describe("개수·요약·자동입력 비교표 순서", () => {
  it("이메일을 적으면 적은 것 +1 · 안 적은 것 −1", () => {
    const groups = [대표자_ITEMS, 기업정보_ITEMS, 재무_ITEMS];
    const [f0, e0] = countFields(groups, CompanyInfo.parse({}));
    const [f1, e1] = countFields(groups, CompanyInfo.parse({ 이메일: "ceo@example.com" }));
    expect([f1 - f0, e0 - e1]).toEqual([1, 1]);
  });

  it("헤더 요약 「홍길동 외 N항목」의 N 에 이메일이 들어간다", () => {
    render({ 대표자이름: "홍길동" });
    const before = el!.textContent!.match(/홍길동 외 (\d+)항목/)![1];
    act(() => root?.unmount());
    el?.remove();
    render({ 대표자이름: "홍길동", 이메일: "ceo@example.com" });
    const after = el!.textContent!.match(/홍길동 외 (\d+)항목/)![1];
    expect(Number(after) - Number(before)).toBe(1);
  });

  it("문서 자동입력 비교표 라벨·순서 = 연락처/통신사 다음 「이메일」", () => {
    const list = companyInfoFieldList(2026);
    const at = list.findIndex(([k]) => k === "연락처통신사");
    expect(list[at + 1]).toEqual(["이메일", "이메일"]);
  });
});
