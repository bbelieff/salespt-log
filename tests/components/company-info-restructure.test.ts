// @vitest-environment jsdom
/**
 * 업체정보 편집기 재구성 (company-info-restructure, belie 2026-09-28).
 *  ① 섹션 순서 [대표자] → [기업정보] → [재무]
 *  ② 사업자구분 · 과세유형 한 칸 선택(옛 값 보존) · 법인등록번호는 법인일 때만
 *  ③ 소유여부 [면적 | 드롭다운] + 임차면 [보증금 | 월세](천원 보이기·원 저장) + 옛 글 안내 — 기업정보·대표자 같은 모양
 *  ④ 업종 · 업태 · 주생산품목 한 줄
 *  ⑤ [재무] 연도 라벨(주입한 오늘) · 연도별 매출 4줄×3칸(상반기|하반기|합계, company-finance-won-grid) ·
 *     매출증가율 자동 · 옛 한 칸 값 읽기 전용 메모
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
      h(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave: () => undefined, hideSave: true, defaultLayout: "extended" }),
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

  it("법인등록번호 빈 칸은 법인일 때만 보인다", () => {
    render({ 사업자구분: "개인", 과세유형: "일반과세자" });
    expect(byKey(groupEl("기업정보"), "법인등록번호")).toBeNull();
    act(() => root?.unmount());
    el?.remove();
    render({ 사업자구분: "법인", 과세유형: "일반과세자" });
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "사업자구분")!;
    expect(byKey(groupEl("기업정보"), "법인등록번호")!.value).toBe("");
    expect(sel.value).toBe("법인|일반과세자");
  });

  it("이미 적힌 법인등록번호는 구분이 법인이 아니어도 보인다(안 보이는 데이터 방지)", () => {
    // 옛 자유 글 구분("주식회사") · 자동입력이 개인 구분 옆에 번호를 채운 경우 — 숨으면 고칠 수도 없다.
    for (const 사업자구분 of ["주식회사", "개인", ""]) {
      render({ 사업자구분, 법인등록번호: "110111-0000000" });
      expect(byKey(groupEl("기업정보"), "법인등록번호")!.value).toBe("110111-0000000");
      expect(stage).not.toHaveBeenCalled(); // 보여 주기만 — 값은 건드리지 않는다
      act(() => root?.unmount());
      el?.remove();
    }
  });
});

describe("③ 소유여부 — 기업정보 ([면적 | 소유여부 드롭다운] + 임차면 [보증금 | 월세] 천원, belie 2026-11-04)", () => {
  const lease = (g: HTMLElement) => g.querySelector<HTMLElement>('[aria-label="임차 조건"]');

  it("드롭다운 선택지는 자가·임차·임차(무상)·기타, 면적이 같은 줄 왼쪽", () => {
    render();
    const g = groupEl("기업정보");
    const sel = byKey<HTMLSelectElement>(g, "소유여부")!;
    expect(sel.tagName).toBe("SELECT");
    expect([...sel.options].map((o) => o.value)).toEqual(["", "자가", "임차", "임차(무상)", "기타"]);
    const row = sel.closest(".grid")!;
    expect(row.contains(byKey(g, "임차면적"))).toBe(true);
    expect(lease(g)).toBeNull();
    choose(sel, "임차");
    expect(staged().소유여부).toBe("임차");
    expect(staged().업체기타메모).toBe("");
  });

  it("주소지(소재지) 아래에 면적·소유여부, 기타메모는 맨 아래", () => {
    render({ 업체기타메모: "적은 메모", 소재지: "서울특별시 중구 세종대로 1" });
    const ids = [...groupEl("기업정보").querySelectorAll("input, select, textarea")].map((i) => i.id.split("-").at(-1));
    expect(ids.indexOf("소재지")).toBeLessThan(ids.indexOf("임차면적"));
    expect(ids.indexOf("임차면적")).toBeLessThan(ids.indexOf("소유여부"));
    expect(ids.filter(Boolean).at(-1)).toBe("업체기타메모");
  });

  it("임차(무상)·자가·기타는 보증금·월세 칸이 없다", () => {
    for (const 소유여부 of ["임차(무상)", "자가", "기타"]) {
      render({ 소유여부 });
      expect(lease(groupEl("기업정보"))).toBeNull();
      act(() => root?.unmount());
      el?.remove();
    }
  });

  it("임차면 보증금·월세가 소유여부 아래 한 줄 — 천원으로 보이고 적고, 저장은 원", () => {
    render({ 소유여부: "임차", 임차보증금: "10,000,000", 임차월세: "500000" });
    const row = lease(groupEl("기업정보"))!;
    const inputs = [...row.querySelectorAll("input")];
    expect(inputs.map((i) => i.id.split("-").at(-1))).toEqual(["임차보증금", "임차월세"]);
    expect(inputs.map((i) => labelOf(i))).toEqual(["보증금", "월세"]);
    expect(inputs.map((i) => i.value)).toEqual(["10,000", "500"]);
    expect(row.textContent).toContain("천원"); // 칸 안 흐린 단위
    typeInto(inputs[0]!, "20000");
    expect(staged().임차보증금).toBe("20,000,000");
    typeInto(inputs[1]!, "1.5");
    expect(staged().임차월세).toBe("1,500");
    expect(inputs[1]!.value).toBe("1.5"); // 적는 중 글은 그대로
  });

  it("옛 '1,000만' 은 그대로 보이고 단위를 또 붙이지 않는다", () => {
    render({ 소유여부: "", 임차보증금: "1,000만" });
    const dep = byKey(groupEl("기업정보"), "임차보증금")!;
    expect(dep.value).toBe("1,000만");
    expect(dep.parentElement!.textContent).not.toContain("천원");
  });

  it("옛 자유 글은 고를 수 없는 「지금 값」으로 보이고, 바꾸면 원문을 기타메모로 옮긴다", () => {
    render({ 소유여부: "임차 : 보 1000만, 월 50만", 업체기타메모: "기존 메모" });
    const sel = byKey<HTMLSelectElement>(groupEl("기업정보"), "소유여부")!;
    expect(sel.options[sel.selectedIndex]!.textContent).toBe("임차 : 보 1000만, 월 50만");
    expect(sel.options[sel.selectedIndex]!.disabled).toBe(true);
    choose(sel, "자가");
    expect(staged().소유여부).toBe("자가");
    expect(staged().업체기타메모).toBe(["기존 메모", "소유여부 이전 내용: 임차 : 보 1000만, 월 50만"].join("\n"));
  });

  it("4대보험 직원과 특허 및 인증이 한 줄", () => {
    render();
    const g = groupEl("기업정보");
    const row = byKey(g, "사대보험직원")!.closest(".grid")!;
    expect(row.contains(byKey(g, "특허및인증"))).toBe(true);
    expect(row.className).toContain("grid-cols-2");
  });
});

describe("③ 소유여부 — 대표자(같은 모양, 대표 전용 키)", () => {
  it("대표소유여부 드롭다운 + 대표임차 칸", () => {
    render({ 대표소유여부: "임차", 대표임차면적: "33", 대표임차보증금: "50000000" });
    const g = groupEl("대표자");
    expect(byKey<HTMLSelectElement>(g, "대표소유여부")!.value).toBe("임차");
    expect(byKey(g, "대표임차면적")!.value).toBe("33");
    expect(byKey(g, "대표임차보증금")!.value).toBe("50,000");
    typeInto(byKey(g, "대표임차월세")!, "500");
    expect(staged().대표임차월세).toBe("500,000");
    expect(staged().임차월세).toBe(""); // 기업정보 칸은 그대로
  });

  it("옛 글은 다른 값을 고를 때 대표 기타메모로 옮긴다", () => {
    render({ 대표소유여부: "배우자명의 무상사용" });
    const sel = byKey<HTMLSelectElement>(groupEl("대표자"), "대표소유여부")!;
    choose(sel, "임차(무상)");
    expect(staged().대표소유여부).toBe("임차(무상)");
    expect(staged().대표기타메모).toBe("소유여부 이전 내용: 배우자명의 무상사용");
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

  it("해가 바뀌면 라벨 연도도 따라간다(기준 연도가 비어 있을 때)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 2));
    render();
    expect(labelOf(byKey(groupEl("재무"), "금년도매출")!)).toBe("매출 Y(2027)");
    expect(labelOf(byKey(groupEl("재무"), "매출Y3하")!)).toBe("Y-3(2024) 하반기");
    expect(byKey(groupEl("연도별 매출"), "매출기준연도")!.value).toBe("2027");
    expect(stage).not.toHaveBeenCalled(); // 열기만 해선 기준 연도를 저장하지 않는다
  });

  it("연도별 매출 = 연도 4개(가로) × 연매출·상반기·하반기(세로)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 28));
    render({ 매출Y1상: "120" });
    const grid = groupEl("연도별 매출");
    expect(grid.querySelectorAll("[data-sales-row]")).toHaveLength(4);
    const cells = [0, 1, 2, 3].map((y) =>
      [...grid.querySelectorAll<HTMLElement>(`[data-sales-cell="${y}"]`)].map((c) => c.querySelector<HTMLInputElement>("input")!),
    );
    expect(cells.map((c) => c.map((i) => labelOf(i)))).toEqual([
      ["매출 Y(2026)", "Y(2026) 상반기", "Y(2026) 하반기"],
      ["매출 Y-1(2025)", "Y-1(2025) 상반기", "Y-1(2025) 하반기"],
      ["매출 Y-2(2024)", "Y-2(2024) 상반기", "Y-2(2024) 하반기"],
      ["매출 Y-3(2023)", "Y-3(2023) 상반기", "Y-3(2023) 하반기"],
    ]);
    expect(cells[1]![1]!.value).toBe("120");
    typeInto(cells[3]![2]!, "90");
    expect(staged().매출Y3하).toBe("90");
    expect(staged().과년도매출Y3).toBe("90"); // 합계 자동 저장
  });

  it("매출증가율 3칸은 연도 합계에서 자동 계산(읽기 전용), 저장 때 같은 값이 들어간다", () => {
    render({ 과년도매출Y3: "23' 100백만", 과년도매출Y2: "24' 125백만", 과년도매출: "25' 200백만" });
    const g = groupEl("매출증가율");
    const y3y2 = byKey(g, "매출증가율Y3Y2")!;
    expect(y3y2.readOnly).toBe(true);
    expect(y3y2.value).toBe("+25.0%");
    expect(byKey(g, "매출증가율Y2Y1")!.value).toBe("+60.0%");
    expect(byKey(g, "매출증가율Y1Y")!.value).toBe(""); // 올해 매출 없음
    expect([...g.querySelectorAll("label")].map((l) => l.textContent)).toEqual(["Y-3→Y-2", "Y-2→Y-1", "Y-1→Y"]);
    typeInto(byKey(groupEl("재무"), "금년도매출")!, "150");
    expect(staged().매출증가율Y1Y).toBe("-25.0%");
    expect(staged().매출증가율Y3Y2).toBe("+25.0%");
  });

  it("Y 가 몇 월까지인 매출이면 Y-1→Y 설명에 안내가 붙는다(기준 연도로 — '올해' 가 아님)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 28));
    render({ 매출기준연도: "2025", 과년도매출: "24' 200백만", 금년도매출: "25' 6월 150백만" });
    const input = byKey(groupEl("매출증가율"), "매출증가율Y1Y")!;
    const desc = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(desc.textContent).toContain("Y(2025)는 6월까지 매출이라 낮게 보일 수 있어요");
    const y2y1 = byKey(groupEl("매출증가율"), "매출증가율Y2Y1")!;
    expect(document.getElementById(y2y1.getAttribute("aria-describedby")!)!.textContent).not.toContain("6월까지");
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
  it("세 칸 줄(업종 줄·증가율 줄)은 360px 미만 1열, 칸은 줄어들 수 있다(min-w-0)", () => {
    render({ 소유여부: "임차" });
    const rows = [
      byKey(groupEl("기업정보"), "업태")!.closest<HTMLElement>(".xs\\:grid-cols-3")!,
      groupEl("매출증가율"),
    ];
    for (const row of rows) {
      expect(row.className).toContain("grid-cols-1");
      expect(row.className).toContain("xs:grid-cols-3");
      for (const cell of row.children) expect((cell as HTMLElement).className).toContain("min-w-0");
    }
    // 개업일 줄은 칸 묶음 너비로 바뀐다(globals.css .company-biz-row) — 칸은 줄어들 수 있다.
    const biz = byKey(groupEl("기업정보"), "개업일")!.closest<HTMLElement>(".company-biz-row-grid")!;
    for (const cell of biz.children) expect((cell as HTMLElement).className).toContain("min-w-0");
    // 두 칸 줄(임차 조건)은 폰에서도 둘 — 칸이 줄어들 수 있다.
    const lease = groupEl("기업정보").querySelector<HTMLElement>('[aria-label="임차 조건"]')!;
    for (const cell of lease.children) expect((cell as HTMLElement).className).toContain("min-w-0");
  });

  it("개업일 · 사업자구분/과세유형 · 사업자등록번호가 한 줄(belie 2026-11-04)", () => {
    render();
    const g = groupEl("기업정보");
    const row = byKey(g, "개업일")!.closest<HTMLElement>(".company-biz-row-grid")!;
    expect(row.contains(byKey(g, "사업자구분"))).toBe(true);
    expect(row.contains(byKey(g, "사업자등록번호"))).toBe(true);
  });
});
