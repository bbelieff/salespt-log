// @vitest-environment jsdom
/**
 * 업체정보 편집기 재구성 (company-info-restructure, belie 2026-09-28).
 *  ① 섹션 순서 [대표자] → [기업정보] → [재무]
 *  ② 사업자구분 · 과세유형 한 칸 선택(옛 값 보존) · 법인등록번호는 법인일 때만
 *  ③ 소유여부 자가/임차 선택 + 임차 한 줄(보증금 원·월세 원·면적 ㎡) + 옛 글 안내 — 기업정보·대표자 같은 모양
 *  ④ 업종 · 업태 · 주생산품목 한 줄
 *  ⑤ [재무] 연도 라벨(주입한 오늘) · 반기 4×2 · 매출증가율 자동 · 옛 한 칸 값 읽기 전용 메모
 *  ⑥ 좁은 폰(375px): 한 줄 묶음은 360px 미만에서 세로로 쌓이고 칸이 줄어들 수 있다(가로 넘침 방지 클래스)
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";

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

function render(value: Partial<CompanyInfo> = {}) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(
      h(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave: () => undefined, hideSave: true }),
    );
  });
}

const groupEl = (name: string) => el!.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`)!;
const byKey = <T extends HTMLElement = HTMLInputElement>(scope: HTMLElement, key: string) =>
  scope.querySelector<T>(`[id$="-${key}"]`);
const labelOf = (input: HTMLElement) => el!.querySelector(`label[for="${input.id}"]`)?.textContent;
const staged = () => stage.mock.calls.at(-1)![0] as CompanyInfo;

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function choose(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  stage.mockReset();
  vi.useRealTimers();
});

describe("① 섹션 순서", () => {
  it("[대표자] → [기업정보] → [재무]", () => {
    render();
    const order = [...el!.querySelectorAll('[role="group"][aria-label]')]
      .map((g) => g.getAttribute("aria-label"))
      .filter((n) => ["대표자", "기업정보", "재무", "업체"].includes(n!));
    expect(order).toEqual(["대표자", "기업정보", "재무"]);
  });

  it("매출·기대출(사업자)은 [재무] 로 옮겨졌다", () => {
    render();
    for (const k of ["금년도매출", "과년도매출", "과년도매출Y2", "과년도매출Y3", "기대출사업자"]) {
      expect(byKey(groupEl("기업정보"), k)).toBeNull();
      expect(byKey(groupEl("재무"), k)).not.toBeNull();
    }
  });
});

describe("② 사업자구분 · 과세유형 / 법인등록번호", () => {
  it("한 칸 select — 고르면 두 저장 키를 함께 쓴다", () => {
    render();
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "사업자구분")!;
    expect(sel.tagName).toBe("SELECT");
    expect(labelOf(sel)).toBe("사업자구분 · 과세유형");
    expect(byKey(groupEl("기업정보"), "과세유형")).toBeNull(); // 따로 칸이 없다
    choose(sel, "법인|일반과세자");
    expect(staged().사업자구분).toBe("법인");
    expect(staged().과세유형).toBe("일반과세자");
  });

  it("과세유형이 빈 옛 값 → '개인 · 과세유형 선택' 이 선택된 채(고를 수는 없음) 보인다", () => {
    render({ 사업자구분: "개인" });
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "사업자구분")!;
    const opt = sel.options[sel.selectedIndex]!;
    expect(opt.textContent).toBe("개인 · 과세유형 선택");
    expect(opt.disabled).toBe(true);
  });

  it("모르는 자유 글은 그대로 보이고, 바꾸면 기타메모로 옮겨 둔다", () => {
    render({ 사업자구분: "개인(공동대표)", 업체기타메모: "기존 메모" });
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "사업자구분")!;
    expect(sel.options[sel.selectedIndex]!.textContent).toBe("개인(공동대표) · 과세유형 선택");
    choose(sel, "개인|간이과세자");
    expect(staged().사업자구분).toBe("개인");
    expect(staged().과세유형).toBe("간이과세자");
    expect(staged().업체기타메모).toBe("기존 메모\n이전 사업자구분: 개인(공동대표)");
  });

  it("법인등록번호는 법인일 때만 보인다(개인이면 숨기고 저장값은 건드리지 않는다)", () => {
    render({ 사업자구분: "개인", 법인등록번호: "110111-0000000" });
    expect(byKey(groupEl("기업정보"), "법인등록번호")).toBeNull();
    expect(stage).not.toHaveBeenCalled();
    act(() => root?.unmount());
    el?.remove();
    render({ 사업자구분: "법인", 과세유형: "일반과세자", 법인등록번호: "110111-0000000" });
    expect(byKey(groupEl("기업정보"), "법인등록번호")!.value).toBe("110111-0000000");
  });
});

describe("③ 소유여부 — 기업정보", () => {
  it("선택 자가/임차, 임차가 아니면 임차 칸이 없다", () => {
    render();
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "소유여부")!;
    expect([...sel.options].map((o) => o.value)).toEqual(["", "자가", "임차"]);
    expect(groupEl("기업정보").querySelector('[aria-label="임차 조건"]')).toBeNull();
    choose(sel, "임차");
    expect(staged().소유여부).toBe("임차");
    expect(staged().업체기타메모).toBe("");
  });

  it("임차면 보증금(원)·월세(원)·면적(㎡) 세 칸이 한 줄, 숫자는 쉼표로", () => {
    render({ 소유여부: "임차" });
    const row = groupEl("기업정보").querySelector<HTMLElement>('[aria-label="임차 조건"]')!;
    const inputs = [...row.querySelectorAll("input")];
    expect(inputs.map((i) => i.id.split("-").at(-1))).toEqual(["임차보증금", "임차월세", "임차면적"]);
    expect(inputs.map((i) => labelOf(i))).toEqual(["보증금", "월세", "면적"]);
    expect(row.textContent).toContain("원");
    expect(row.textContent).toContain("㎡");
    expect(row.className).toContain("xs:grid-cols-3");
    typeInto(inputs[0]!, "10000000");
    expect(staged().임차보증금).toBe("10,000,000");
    typeInto(inputs[2]!, "33.5");
    expect(staged().임차면적).toBe("33.5");
  });

  it("옛 자유 글 → 선택을 짐작하고 원문은 칸 아래에, 바꾸면 기타메모로 옮긴다", () => {
    render({ 소유여부: "임차 : 보 1000만, 월 50만" });
    const g = groupEl("기업정보");
    const sel = byKey<HTMLSelectElement>(g, "소유여부")!;
    expect(sel.value).toBe("임차");
    expect(g.querySelector('[role="note"]')!.textContent).toContain("이전에 적은 내용: 임차 : 보 1000만, 월 50만");
    choose(sel, "자가");
    expect(staged().소유여부).toBe("자가");
    expect(staged().업체기타메모).toBe("소유여부 이전 내용: 임차 : 보 1000만, 월 50만");
  });

  it("낱말 그대로(자가)면 안내가 없고, 이미 적힌 임차 값(1,000만)은 선택과 무관하게 보인다", () => {
    render({ 소유여부: "", 임차보증금: "1,000만" });
    const g = groupEl("기업정보");
    expect(g.querySelector('[role="note"]')).toBeNull();
    const dep = byKey(g, "임차보증금")!;
    expect(dep.value).toBe("1,000만");
    // 단위가 이미 적힌 옛 값에는 "원" 을 또 붙이지 않는다.
    expect(dep.parentElement!.textContent).not.toContain("원");
  });
});

describe("③ 소유여부 — 대표자(같은 모양, 대표 전용 키)", () => {
  it("대표소유여부 선택 + 대표임차 3칸", () => {
    render({ 대표소유여부: "임차", 대표임차면적: "33" });
    const g = groupEl("대표자");
    expect(byKey<HTMLSelectElement>(g, "대표소유여부")!.value).toBe("임차");
    const row = g.querySelector<HTMLElement>('[aria-label="임차 조건"]')!;
    expect([...row.querySelectorAll("input")].map((i) => i.id.split("-").at(-1))).toEqual([
      "대표임차보증금",
      "대표임차월세",
      "대표임차면적",
    ]);
    expect(byKey(g, "대표임차면적")!.value).toBe("33");
    typeInto(byKey(g, "대표임차월세")!, "500000");
    expect(staged().대표임차월세).toBe("500,000");
    expect(staged().임차월세).toBe(""); // 기업정보 칸은 그대로
  });

  it("옛 글은 대표 기타메모로 옮긴다", () => {
    render({ 대표소유여부: "자가 / 임차 : 보 00만, 월 00만" });
    const sel = byKey<HTMLSelectElement>(groupEl("대표자"), "대표소유여부")!;
    expect(sel.value).toBe("자가");
    choose(sel, "임차");
    expect(staged().대표소유여부).toBe("임차");
    expect(staged().대표기타메모).toBe("소유여부 이전 내용: 자가 / 임차 : 보 00만, 월 00만");
    expect(staged().업체기타메모).toBe("");
  });

  it("주민등록번호 라벨은 '주민등록번호', 예시 글(placeholder) 없음", () => {
    render();
    const rrn = byKey(groupEl("대표자"), "주민등록번호")!;
    expect(labelOf(rrn)).toBe("주민등록번호");
    expect(rrn.hasAttribute("placeholder")).toBe(false);
  });
});

describe("④ 업종 · 업태 · 주생산품목", () => {
  it("세 칸이 한 줄 묶음 — 옛 업종주생산품목 값은 '업종' 칸에", () => {
    render({ 업종주생산품목: "제조/필름", 업태: "제조", 주생산품목: "포장용 필름" });
    const g = groupEl("기업정보");
    const 업종 = byKey(g, "업종주생산품목")!;
    expect(labelOf(업종)).toBe("업종");
    expect(업종.value).toBe("제조/필름");
    const row = 업종.closest<HTMLElement>(".xs\\:grid-cols-3")!;
    expect([...row.querySelectorAll("input")].map((i) => i.value)).toEqual(["제조/필름", "제조", "포장용 필름"]);
    typeInto(byKey(g, "주생산품목")!, "보호 필름");
    expect(staged().주생산품목).toBe("보호 필름");
  });
});

describe("⑤ [재무] 매출", () => {
  it("연도 라벨 = 오늘(주입) 기준 Y(2026) … Y-3(2023)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 28));
    render();
    const g = groupEl("재무");
    expect(["금년도매출", "과년도매출", "과년도매출Y2", "과년도매출Y3"].map((k) => labelOf(byKey(g, k)!))).toEqual([
      "매출 Y(2026)",
      "매출 Y-1(2025)",
      "매출 Y-2(2024)",
      "매출 Y-3(2023)",
    ]);
  });

  it("해가 바뀌면 라벨 연도도 따라간다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 2));
    render();
    expect(labelOf(byKey(groupEl("재무"), "금년도매출")!)).toBe("매출 Y(2027)");
    expect(labelOf(byKey(groupEl("재무"), "매출Y3하")!)).toBe("Y-3(2024) 하반기");
  });

  it("반기 매출 = 4줄 × 2칸(상반기 | 하반기)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 28));
    render({ 매출Y1상: "1.2억" });
    const grid = groupEl("반기별 매출");
    expect(grid.className).toContain("grid-cols-2");
    const inputs = [...grid.querySelectorAll("input")];
    expect(inputs.map((i) => labelOf(i))).toEqual([
      "Y(2026) 상반기",
      "Y(2026) 하반기",
      "Y-1(2025) 상반기",
      "Y-1(2025) 하반기",
      "Y-2(2024) 상반기",
      "Y-2(2024) 하반기",
      "Y-3(2023) 상반기",
      "Y-3(2023) 하반기",
    ]);
    expect(inputs[2]!.value).toBe("1.2억");
    typeInto(inputs[7]!, "9,000만");
    expect(staged().매출Y3하).toBe("9,000만");
  });

  it("매출증가율 3칸은 연도 매출에서 자동 계산(읽기 전용), 저장 때 같은 값이 들어간다", () => {
    render({ 과년도매출Y3: "23' 100백만", 과년도매출Y2: "24' 125백만", 과년도매출: "25' 200백만" });
    const g = groupEl("매출증가율");
    const y3y2 = byKey(g, "매출증가율Y3Y2")!;
    expect(y3y2.readOnly).toBe(true);
    expect(y3y2.value).toBe("+25.0%");
    expect(byKey(g, "매출증가율Y2Y1")!.value).toBe("+60.0%");
    expect(byKey(g, "매출증가율Y1Y")!.value).toBe(""); // 올해 매출 없음
    expect([...g.querySelectorAll("label")].map((l) => l.textContent)).toEqual(["Y-3→Y-2", "Y-2→Y-1", "Y-1→Y"]);
    typeInto(byKey(groupEl("재무"), "금년도매출")!, "26' 6월 150백만");
    expect(staged().매출증가율Y1Y).toBe("-25.0%");
    expect(staged().매출증가율Y3Y2).toBe("+25.0%");
  });

  it("올해가 몇 월까지인 매출이면 Y-1→Y 설명에 안내가 붙는다", () => {
    render({ 과년도매출: "25' 200백만", 금년도매출: "26' 6월 150백만" });
    const input = byKey(groupEl("매출증가율"), "매출증가율Y1Y")!;
    const desc = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(desc.textContent).toContain("올해는 6월까지 매출이라 낮게 보일 수 있어요");
    const y2y1 = byKey(groupEl("매출증가율"), "매출증가율Y2Y1")!;
    expect(document.getElementById(y2y1.getAttribute("aria-describedby")!)!.textContent).not.toContain("올해는");
  });

  it("옛 한 칸 반기별매출·매출증가율은 입력칸 없이 읽기 전용 메모로만(값이 있을 때)", () => {
    render({ 반기별매출: "25년 상반기 1.2억\n25년 하반기 1.3억", 매출증가율: "12%" });
    const g = groupEl("재무");
    expect(byKey(g, "반기별매출")).toBeNull();
    expect(g.querySelector('[role="note"][aria-label="이전 반기별 매출 메모"]')!.textContent).toContain(
      "25년 하반기 1.3억",
    );
    expect(g.querySelector('[role="note"][aria-label="이전 매출증가율 메모"]')!.textContent).toContain("12%");
    act(() => root?.unmount());
    el?.remove();
    render();
    expect(groupEl("재무").querySelector('[role="note"]')).toBeNull();
  });
});

describe("⑥ 좁은 폰 가로 넘침 방지", () => {
  it("한 줄 묶음(업종 줄·임차 줄·증가율 줄)은 360px 미만 1열, 칸은 줄어들 수 있다(min-w-0)", () => {
    render({ 소유여부: "임차" });
    const rows = [
      byKey(groupEl("기업정보"), "업태")!.closest<HTMLElement>(".xs\\:grid-cols-3")!,
      groupEl("기업정보").querySelector<HTMLElement>('[aria-label="임차 조건"]')!,
      groupEl("매출증가율"),
    ];
    for (const row of rows) {
      expect(row.className).toContain("grid-cols-1");
      expect(row.className).toContain("xs:grid-cols-3");
      for (const cell of row.children) expect((cell as HTMLElement).className).toContain("min-w-0");
    }
  });
});
