// @vitest-environment jsdom
/**
 * 업체정보 [재무] 백만원·연도별 매출 표·기준 연도·자동 비율 + [기업정보]/[대표자] 배치
 * (company-finance-won-grid, belie 2026-09-28). 합성 값만.
 *  A 금액 칸: 백만원 단위 표시 · 소수 한 자리 · 손익만 음수 · blur 쉼표 · "약 …" · 옛 자유 글 안내/「백만원으로 바꾸기」
 *  B 연도별 매출: 합계 자동(읽기 전용)·한쪽만·읽을 수 없는 반기·둘 다 비면 직접 입력·이전에 적은 합계
 *  C 기준 연도: 비면 오늘 연도로 보이고 저장 안 함 · 바꾸면 칸 이름만 · 2000~2100 검사 · 재무 칸 첫 저장 때 함께
 *  D 비율: 자동 계산(읽기 전용) · 옛 값은 "이전에 적은 값"
 *  E 기업정보 순서 · F 대표자 한 줄 묶음·생년월일 칸 없음·주민등록번호 자동 표시(열기만 해선 저장 안 함)
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 28));
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(h(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave: () => undefined, hideSave: true }));
  });
}

function unmount() {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
}

const groupEl = (name: string) => el!.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`)!;
const byKey = (scope: HTMLElement, key: string) => scope.querySelector<HTMLInputElement>(`[id$="-${key}"]`);
const labelOf = (input: HTMLElement) => el!.querySelector(`label[for="${input.id}"]`)?.textContent;
const staged = () => stage.mock.calls.at(-1)![0] as CompanyInfo;
const rowOf = (i: number) => groupEl("연도별 매출").querySelector<HTMLElement>(`[data-sales-row="${i}"]`)!;
/** 금액 칸 하나(라벨·입력·도움말·옛 글 안내)를 감싼 상자. */
const fieldBox = (input: HTMLInputElement) => input.closest("div.min-w-0")!.parentElement!;
const buttonIn = (scope: HTMLElement, text: string) =>
  [...scope.querySelectorAll("button")].find((b) => b.textContent === text);

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function blur(input: HTMLInputElement) {
  act(() => {
    input.focus();
    input.blur();
  });
}

afterEach(() => {
  unmount();
  stage.mockReset();
  vi.useRealTimers();
});

describe("A 금액 칸 — 백만원", () => {
  it("'백만원' 단위가 보이고, 소수는 한 자리까지만(넘치면 잘라 알림)", () => {
    render();
    const input = byKey(groupEl("재무"), "영업이익")!;
    expect(input.parentElement!.textContent).toContain("백만원");
    typeInto(input, "250.12");
    expect(staged().영업이익).toBe("250.1");
    expect(fieldBox(input).textContent).toContain("소수는 한 자리까지만 적어요");
  });

  it("손익 칸만 음수, 칸을 떠날 때 천 단위 쉼표, 읽기 도움말 '약 …'", () => {
    render({ 영업이익: "1234", 자산총계: "250.1" });
    const g = groupEl("재무");
    blur(byKey(g, "영업이익")!);
    expect(staged().영업이익).toBe("1,234");
    typeInto(byKey(g, "당기순이익")!, "-3.2");
    expect(staged().당기순이익).toBe("-3.2");
    typeInto(byKey(g, "자산총계")!, "-5");
    expect(staged().자산총계).toBe("5");
    unmount();
    render({ 자산총계: "250.1", 부채총계: "32" });
    expect(fieldBox(byKey(groupEl("재무"), "자산총계")!).textContent).toContain("약 2.5억");
    expect(fieldBox(byKey(groupEl("재무"), "부채총계")!).textContent).toContain("약 3,200만");
  });

  it("옛 자유 글은 그대로 보이고(열기만 해선 안 바꿈) 안내 + 「백만원으로 바꾸기」", () => {
    render({ 영업이익: "-3,200만", 자산총계: "모름" });
    const g = groupEl("재무");
    expect(byKey(g, "영업이익")!.value).toBe("-3,200만");
    expect(stage).not.toHaveBeenCalled();
    const note = fieldBox(byKey(g, "영업이익")!).querySelector<HTMLElement>('[role="note"]')!;
    expect(note.textContent).toContain("글로 적힌 값이에요 — 계산에는 -32백만원으로 써요");
    act(() => buttonIn(note, "백만원으로 바꾸기")!.click());
    expect(staged().영업이익).toBe("-32");
    const bad = fieldBox(byKey(g, "자산총계")!).querySelector<HTMLElement>('[role="note"]')!;
    expect(bad.textContent).toContain("읽을 수 없어 계산에서 빠져요");
    expect(buttonIn(bad, "백만원으로 바꾸기")).toBeUndefined();
  });

  it("매출 칸 옛 글 — 단위 없는 숫자는 백만원, 몇 월 표시는 바꿀 때 기타메모로", () => {
    render({ 과년도매출: "25' 250", 금년도매출: "26' 6월 100백만", 업체기타메모: "기존" });
    const r0 = rowOf(0);
    expect(rowOf(1).textContent).toContain("매출 Y-1(2025): 글로 적힌 값이에요 — 계산에는 250백만원으로 써요");
    expect(r0.textContent).toContain("매출 Y(2026): 글로 적힌 값이에요 — 계산에는 100백만원으로 써요");
    act(() => buttonIn(r0, "백만원으로 바꾸기")!.click());
    expect(staged().금년도매출).toBe("100");
    expect(staged().업체기타메모).toBe("기존\n매출 Y(2026) 원래 적은 값: 26' 6월 100백만");
    expect(staged().과년도매출).toBe("25' 250"); // 다른 칸은 그대로
  });
});

describe("B 연도별 매출 합계", () => {
  it("상·하반기 → 합계 읽기 전용(반기 합) + '약 …'", () => {
    render({ 매출Y1상: "120", 매출Y1하: "130.5" });
    const total = byKey(rowOf(1), "과년도매출")!;
    expect(total.readOnly).toBe(true);
    expect(total.value).toBe("250.5");
    expect(rowOf(1).textContent).toContain("약 2.5억");
    expect(stage).not.toHaveBeenCalled(); // 표시만 — 저장은 다음 편집 때
  });

  it("한쪽만 → 그 반기만 더하고 안내, 저장하면 합계도 함께", () => {
    render();
    typeInto(byKey(rowOf(2), "매출Y2상")!, "80");
    expect(staged().과년도매출Y2).toBe("80");
    unmount();
    render({ 매출Y2상: "80" });
    expect(rowOf(2).textContent).toContain("하반기가 비어 있어 상반기만 더했어요");
  });

  it("반기에 읽을 수 없는 글 → 합계를 덮지 않고 알림(합계는 직접 적는 칸)", () => {
    render({ 매출Y1상: "모름", 과년도매출: "300" });
    const total = byKey(rowOf(1), "과년도매출")!;
    expect(total.readOnly).toBe(false);
    expect(total.value).toBe("300");
    expect(rowOf(1).textContent).toContain("합계를 자동으로 더하지 않아요");
  });

  it("반기가 둘 다 비면 합계를 직접 적는다(재무제표 연 매출)", () => {
    render();
    const total = byKey(rowOf(3), "과년도매출Y3")!;
    expect(total.readOnly).toBe(false);
    typeInto(total, "300");
    expect(staged().과년도매출Y3).toBe("300");
  });

  it("다른 금액의 옛 합계 → '이전에 적은 합계', 저장하면 기타메모로 옮기고 합계를 반기 합으로", () => {
    render({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 260백만" });
    expect(rowOf(1).textContent).toContain("이전에 적은 합계 25' 260백만");
    typeInto(byKey(groupEl("재무"), "영업이익")!, "10");
    expect(staged().과년도매출).toBe("250");
    expect(staged().업체기타메모).toBe("매출 Y-1(2025) 이전 합계: 25' 260백만");
  });

  it("375px 폰에서도 세 칸 한 줄 — 줄마다 grid-cols-3, 칸은 줄어들 수 있다(min-w-0)", () => {
    render();
    for (const i of [0, 1, 2, 3]) {
      const cells = rowOf(i).querySelector<HTMLElement>(".grid-cols-3")!;
      expect(cells.className).toContain("min-w-0");
      expect(cells.className).not.toContain("xs:");
      expect(cells.children).toHaveLength(3);
      for (const c of cells.children) expect((c as HTMLElement).className).toContain("min-w-0");
    }
    expect(groupEl("연도별 매출").textContent).toContain("상반기하반기합계");
  });
});

describe("C 매출 기준 연도", () => {
  it("비었으면 오늘 연도로 보이고, 바꾸면 저장 — 칸 이름만 바뀐다", () => {
    render({ 과년도매출: "250" });
    const year = byKey(groupEl("연도별 매출"), "매출기준연도")!;
    expect(year.value).toBe("2026");
    expect(stage).not.toHaveBeenCalled();
    act(() => year.focus());
    typeInto(year, "2025");
    expect(staged().매출기준연도).toBe("2025");
    expect(staged().과년도매출).toBe("250"); // 값은 그대로
    unmount();
    render({ 매출기준연도: "2025", 과년도매출: "250" });
    expect(labelOf(byKey(groupEl("재무"), "과년도매출")!)).toBe("매출 Y-1(2024)");
    expect(byKey(groupEl("재무"), "과년도매출")!.value).toBe("250");
  });

  it("2000~2100 밖이면 저장하지 않고 안내, 칸을 떠나면 이전 연도로", () => {
    render({ 매출기준연도: "2025" });
    const year = byKey(groupEl("연도별 매출"), "매출기준연도")!;
    act(() => year.focus());
    typeInto(year, "1999");
    expect(stage).not.toHaveBeenCalled();
    expect(el!.querySelector('[role="alert"]')!.textContent).toContain("2000~2100");
    act(() => year.blur());
    expect(year.value).toBe("2025");
  });

  it("비어 있으면 재무 칸을 처음 고칠 때 오늘 연도를 함께 저장, 다른 칸이면 비움 그대로", () => {
    render();
    typeInto(byKey(groupEl("대표자"), "대표자이름")!, "홍길동");
    expect(staged().매출기준연도).toBe("");
    typeInto(byKey(groupEl("재무"), "영업이익")!, "32");
    expect(staged().매출기준연도).toBe("2026");
  });
});

describe("D 재무 비율(자동)", () => {
  it("금액에서 계산해 읽기 전용으로 보이고, 저장 때 같은 값", () => {
    render({ 부채총계: "100", 자본총계: "50", 영업이익: "240", 이자비용: "100" });
    const g = groupEl("재무");
    expect(byKey(g, "부채비율")!.readOnly).toBe(true);
    expect(byKey(g, "부채비율")!.value).toBe("200.0%");
    expect(byKey(g, "이자보상배율")!.value).toBe("2.4배");
    typeInto(byKey(g, "자본총계")!, "-1");
    expect(staged().부채비율).toBe("자본잠식");
  });

  it("옛 값이 계산값과 다르면 '이전에 적은 값' 으로 보인다", () => {
    render({ 부채비율: "120%", 부채총계: "100", 자본총계: "50" });
    const box = byKey(groupEl("재무"), "부채비율")!.parentElement!;
    expect(box.textContent).toContain("이전에 적은 값: 120%");
  });
});

describe("E·F 배치", () => {
  it("E [기업정보] — 업종 줄은 등록번호 뒤, 4대보험 직원은 소유여부 뒤", () => {
    render();
    const ids = [...groupEl("기업정보").querySelectorAll("input, select")]
      .map((x) => x.id.split("-").at(-1))
      .filter((k) => k && !k.startsWith(":"));
    const at = (k: string) => ids.indexOf(k);
    expect(at("사업자등록번호")).toBeLessThan(at("업종주생산품목"));
    expect(at("주생산품목")).toBeLessThan(at("소재지"));
    expect(at("소유여부")).toBeLessThan(at("사대보험직원"));
    expect(at("사대보험직원")).toBeLessThan(at("특허및인증"));
  });

  it("F [대표자] — 생년월일 칸 없음, 이름·주민등록번호 한 줄, 신용점수·연락처 한 줄", () => {
    render({ 대표자생년월일: "88.01.24", 주민등록번호: "880124-" });
    const g = groupEl("대표자");
    expect(byKey(g, "대표자생년월일")).toBeNull();
    const pair1 = byKey(g, "대표자이름")!.closest<HTMLElement>(".grid-cols-2")!;
    expect(pair1.contains(byKey(g, "주민등록번호"))).toBe(true);
    const pair2 = byKey(g, "신용점수")!.closest<HTMLElement>(".grid-cols-5")!;
    expect(pair2.contains(byKey(g, "연락처통신사"))).toBe(true);
    expect(pair2.className).not.toContain("xs:"); // 375px 에서도 한 줄
  });

  it("F 주민등록번호가 비면 생년월일로 보여 주기만 — 열기·blur 로는 저장 안 함, 다른 칸을 고치면 함께 저장", () => {
    render({ 대표자생년월일: "1988-01-24" });
    const g = groupEl("대표자");
    const rrn = byKey(g, "주민등록번호")!;
    expect(rrn.value).toBe("880124-");
    const desc = document.getElementById(rrn.getAttribute("aria-describedby")!)!;
    expect(desc.textContent).toContain("자동으로 채운 값");
    blur(rrn);
    expect(stage).not.toHaveBeenCalled();
    typeInto(byKey(g, "대표자이름")!, "홍길동");
    expect(staged().주민등록번호).toBe("880124-");
    expect(staged().대표자생년월일).toBe("1988-01-24"); // 숨긴 칸 값은 그대로
  });
});
