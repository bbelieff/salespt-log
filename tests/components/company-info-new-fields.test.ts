// @vitest-environment jsdom
/**
 * 업체정보 편집기 — 확장2 20칸 (company-info-new-fields).
 *  ① 새 라벨이 제 그룹([기업정보]/[대표자])에, [재무] 섹션이 따로 보인다
 *     (company-info-restructure 2026-09-28 — 업체 → 기업정보, 과세유형은 사업자구분과 한 칸 선택).
 *  ② 새 칸마다 (?) 설명 버튼이 있다.
 *  ③ 주민등록번호 앞자리 — 전체 번호를 붙여넣어도 앞 6자리만 stage 된다, blur 에 마무리.
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

function render(
  value = CompanyInfo.parse({ 대표자이름: "홍길동" }),
  extra: { desktopHeading?: boolean; splitInline?: boolean } = {},
) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(h(CompanyInfoEditor, { value, onSave: () => undefined, hideSave: true, ...extra }));
  });
}

const groupEl = (name: string) =>
  el!.querySelector<HTMLElement>(`[role="group"][aria-label="${name}"]`);

/** React 가 추적하는 value setter 로 입력 이벤트를 흉내낸다. */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  stage.mockReset();
});

describe("CompanyInfoEditor 확장2 칸", () => {
  it("[기업정보]·[대표자]·[재무] 그룹에 새 라벨이 각각 들어간다", () => {
    // 법인·임차일 때만 보이는 칸까지 보이도록 값을 준다.
    render(CompanyInfo.parse({ 대표자이름: "홍길동", 사업자구분: "법인", 과세유형: "일반과세자", 소유여부: "임차" }));
    const 기업 = groupEl("기업정보")!.textContent!;
    for (const l of ["사업자구분 · 과세유형", "업태", "법인등록번호", "보증금", "월세", "면적"]) {
      expect(기업).toContain(l);
    }
    expect(groupEl("대표자")!.textContent).toContain("주민등록번호");
    expect(groupEl("대표자")!.textContent).not.toContain("주민등록번호 앞자리");
    const 재무 = groupEl("재무")!;
    expect(재무.textContent).toContain("[재무]");
    for (const l of [
      "결산연도", "영업이익", "당기순이익", "이자비용", "자산총계", "부채총계", "자본총계",
      "반기별 매출", "면세 수입금액", "부채비율", "이자보상배율", "당기순이익률", "매출증가율",
    ]) {
      expect(재무.textContent).toContain(l);
    }
    // 재무엔 사용자 필드 추가 입력이 없다(기업정보·대표자만).
    expect(재무.querySelector('input[placeholder="필드 추가+ (라벨)"]')).toBeNull();
    expect(재무.querySelector("textarea")).not.toBeNull(); // 기대출 사업자 = 여러 줄
  });

  it("새 칸마다 (?) 설명 버튼이 있다", () => {
    render();
    for (const l of ["사업자구분 · 과세유형", "주민등록번호", "이자보상배율", "Y-1→Y"]) {
      expect(el!.querySelector(`button[aria-label="${l} 설명 보기"]`)).not.toBeNull();
    }
  });

  it("주민등록번호 — 전체 번호를 붙여넣어도 앞 6자리만 저장 대상이 된다", () => {
    render();
    const input = groupEl("대표자")!.querySelector<HTMLInputElement>('input[id$="-주민등록번호"]')!;
    expect(input).not.toBeNull();
    typeInto(input, "800101-1234567");
    const staged = stage.mock.calls.at(-1)![0] as CompanyInfo;
    expect(staged.주민등록번호).toBe("800101-");
    expect(JSON.stringify(stage.mock.calls)).not.toContain("1234567");
  });

  it("주민등록번호 — blur 에서 6자리 숫자를 NNNNNN- 로 마무리", () => {
    // 입력 도중 상태(하이픈 없는 6자리)를 값으로 렌더 — draft 는 mock 이라 blur 만 검사.
    render({ ...CompanyInfo.parse({}), 주민등록번호: "800101" } as CompanyInfo);
    const input = groupEl("대표자")!.querySelector<HTMLInputElement>('input[id$="-주민등록번호"]')!;
    act(() => {
      input.focus();
      input.blur();
    });
    const staged = stage.mock.calls.at(-1)![0] as CompanyInfo;
    expect(staged.주민등록번호).toBe("800101-");
  });

  it("주민등록번호 — 뒷자리가 잘리면 칸 아래에 이유를 보여준다", () => {
    render();
    const input = groupEl("대표자")!.querySelector<HTMLInputElement>('input[id$="-주민등록번호"]')!;
    typeInto(input, "8001011");
    const notice = groupEl("대표자")!.querySelector('[role="status"]');
    expect(notice?.textContent).toContain("앞 6자리만 저장해요");
  });

  it("주민등록번호 — 6자리 미만으로 blur 하면 비우면서 이유를 알린다", () => {
    render({ ...CompanyInfo.parse({}), 주민등록번호: "80010" } as CompanyInfo);
    const input = groupEl("대표자")!.querySelector<HTMLInputElement>('input[id$="-주민등록번호"]')!;
    act(() => {
      input.focus();
      input.blur();
    });
    expect((stage.mock.calls.at(-1)![0] as CompanyInfo).주민등록번호).toBe("");
    const notice = groupEl("대표자")!.querySelector('[role="status"]');
    expect(notice?.textContent).toContain("앞 6자리를 모두 입력해야");
  });

  it("PC 상세 2단(inline)에서 [재무] 내부는 2열 그리드(전폭 1열 금지)", () => {
    render(undefined, { desktopHeading: true, splitInline: true });
    const grid = (name: string) => groupEl(name)!.querySelector<HTMLElement>("div.grid")!.className;
    expect(grid("기업정보")).not.toContain("grid-cols-2"); // 반폭 그룹은 1열 유지
    expect(grid("재무")).toContain("sm:grid-cols-2");
  });
});
