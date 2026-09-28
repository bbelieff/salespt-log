// @vitest-environment jsdom
/**
 * 업체정보 「문서로 자동입력」 팝업 — OCR 실행기는 mock(네트워크·tesseract 없음).
 *  ① 파일 고르기 → 파일 행(문서 종류 자동 판별) → 비교표 행.
 *  ② 기본 체크: 빈 칸만 체크, 지금 값이 있으면 해제. 상호는 참고 정보로만.
 *  ③ 「선택 항목 적용」 = 체크된 칸만 onApply. 편집기에서는 기존 set 경로(stage)로 들어간다.
 *  ④ 다섯 서류 모두 파서가 붙는다(임대차계약서 → 임차보증금). 신분증은 가린 원문으로 읽어
 *     뒷자리·운전면허번호가 화면 어디에도 없다. Esc 로 닫힘.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import { CORP_CERT, LEASE_TEXT, PERSONAL_CERT } from "../document-ocr/fixtures";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ocrText = { value: PERSONAL_CERT };
const runDocumentOcr = vi.fn(async (_file: File, opts?: { onProgress?: (p: unknown) => void }) => {
  opts?.onProgress?.({ stage: "recognizing", ratio: 0.5, message: "문자 인식 중" });
  return { text: ocrText.value, sourceKind: "ocr" as const };
});
vi.mock("@/lib/document-ocr/ocr-client", () => ({ runDocumentOcr: (...a: unknown[]) => runDocumentOcr(...(a as [File])) }));

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

import CompanyDocAutofillDialog from "@/components/company-doc/CompanyDocAutofillDialog";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";

let root: Root | undefined;
let el: HTMLDivElement | undefined;

function mount(node: React.ReactElement) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(node));
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function pickFiles(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(input).not.toBeNull();
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

const png = (name = "cert.png") => new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
const box = (label: string) => {
  const lab = [...document.querySelectorAll("label")].find((l) => l.textContent === label);
  return document.getElementById(lab!.htmlFor) as HTMLInputElement;
};
const buttonByText = (t: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === t)!;

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  document.body.innerHTML = "";
  root = undefined;
  el = undefined;
  stage.mockReset();
  runDocumentOcr.mockClear();
  ocrText.value = PERSONAL_CERT;
});

describe("CompanyDocAutofillDialog", () => {
  it("접근 가능한 대화상자 + 개인정보 안내", () => {
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    const dlg = document.querySelector('[role="dialog"]')!;
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dlg.getAttribute("aria-labelledby")!)!.textContent).toContain("문서로 자동입력");
    expect(dlg.textContent).toContain("파일은 이 기기 안에서만 읽고 저장하지 않아요.");
  });

  it("사업자등록증 → 비교표, 기본 체크 규칙, 체크한 칸만 적용", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    mount(
      h(CompanyDocAutofillDialog, {
        current: CompanyInfo.parse({ 소재지: "서울 어딘가" }),
        onApply,
        onClose,
      }),
    );
    await pickFiles(png());
    expect(runDocumentOcr).toHaveBeenCalledTimes(1);
    const typeSelect = document.querySelector<HTMLSelectElement>('select[aria-label="cert.png 문서 종류"]')!;
    expect(typeSelect.value).toBe("사업자등록증");
    expect(document.body.textContent).toContain("상호: 예시상사");

    expect(box("이름").checked).toBe(true);
    expect(box("사업자등록번호").checked).toBe(true);
    expect(box("소재지").checked).toBe(false); // 지금 값이 있다
    expect(document.body.textContent).toContain("지금 값이 있어 기본으로 안 덮어요");

    // 업태 체크 해제 → 적용에서 빠진다.
    await act(async () => box("업태").click());
    await act(async () => buttonByText("선택 항목 적용").click());
    expect(onApply).toHaveBeenCalledTimes(1);
    const patch = onApply.mock.calls[0]![0] as Record<string, string>;
    expect(patch).toMatchObject({ 대표자이름: "홍길동", 사업자등록번호: "123-45-67891", 개업일: "20.03.02", 대표자생년월일: "80.01.01" });
    expect(patch).not.toHaveProperty("업태");
    expect(patch).not.toHaveProperty("소재지");
    expect(patch).not.toHaveProperty("상호");
    expect(onClose).toHaveBeenCalled();
  });

  it("두 파일이 같은 칸에 다른 값을 내면 충돌 고르기 상자", async () => {
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("a.png"));
    ocrText.value = CORP_CERT;
    await pickFiles(png("b.png"));
    const pick = document.querySelector<HTMLSelectElement>('select[aria-label="개업일 값 고르기"]');
    expect(pick).not.toBeNull();
    expect(pick!.options).toHaveLength(2);
  });

  it("임대차계약서도 읽어 임차보증금·소유여부 칸을 제안한다", async () => {
    ocrText.value = LEASE_TEXT;
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("lease.png"));
    expect(document.body.textContent).not.toContain("곧 지원돼요");
    expect(document.querySelector("table")!.textContent).toContain("10,000,000"); // 원 단위 숫자
    expect(buttonByText("선택 항목 적용").disabled).toBe(false);
  });

  it("신분증 — 주민등록번호 뒷자리·운전면허번호는 화면 어디에도 없다", async () => {
    ocrText.value = [
      "자동차운전면허증",
      "11-12-345678-90",
      "홍길동",
      "800101 - 1 234 567",
      "서울특별시 강남구 예시대로 100",
    ].join("\n");
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("id.png"));
    const shown = document.body.textContent ?? "";
    expect(shown).toContain("800101-");
    expect(shown).toContain("홍길동");
    const digits = shown.replace(/\D/g, "");
    expect(digits).not.toContain("1234567");
    expect(digits).not.toContain("11123456789");
    expect(digits).not.toContain("34567890");
  });

  it("형식이 안 맞는 파일은 OCR 없이 오류 안내", async () => {
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(new File(["x"], "memo.txt", { type: "text/plain" }));
    expect(runDocumentOcr).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')!.textContent).toContain("PDF");
  });

  it("Esc 로 닫힌다", () => {
    const onClose = vi.fn();
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose }));
    const dlg = document.querySelector('[role="dialog"]')!;
    act(() => {
      dlg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CompanyInfoEditor 헤더 「문서로 자동입력」", () => {
  it("버튼 → 팝업(지연 로딩) → 적용하면 편집기 set 경로로 체크한 칸만 들어간다", async () => {
    mount(
      h(CompanyInfoEditor, {
        value: CompanyInfo.parse({ 대표자이름: "김기존" }),
        onSave: () => undefined,
        hideSave: true,
      }),
    );
    await act(async () => buttonByText("문서로 자동입력").click());
    await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await pickFiles(png());
    await act(async () => buttonByText("선택 항목 적용").click());
    const staged = stage.mock.calls.at(-1)![0] as CompanyInfo;
    expect(staged.대표자이름).toBe("김기존"); // 지금 값이 있어 기본 해제 → 그대로
    expect(staged.사업자등록번호).toBe("123-45-67891");
    expect(staged.업태).toBe("도매 및 소매업");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("부가세 과세표준증명 → 반기 칸 + 연도 매출(백만원), 적용하면 합계·매출증가율·기준 연도도 함께 저장", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 28));
    try {
      ocrText.value = [
        "부가가치세 과세표준증명",
        "2025년 2기 확정 2026.01.25 130,000,000",
        "2025년 1기 확정 2025.07.25 120,000,000",
        "2024년 2기 확정 2025.01.25 90,000,000",
        "2024년 1기 확정 2024.07.25 80,000,000",
      ].join("\n");
      mount(h(CompanyInfoEditor, { value: CompanyInfo.parse({}), onSave: () => undefined, hideSave: true }));
      await act(async () => buttonByText("문서로 자동입력").click());
      await flush();
      await pickFiles(png("vat.png"));
      const table = document.querySelector("table")!.textContent!;
      expect(table).toContain("상반기");
      expect(table).not.toContain("반기별 매출");
      // 금액은 백만원 + 문서 원문(원) — 저장값은 백만원 숫자뿐.
      expect(table).toContain("120백만원");
      expect(table).toContain("원문 120,000,000원");
      await act(async () => buttonByText("선택 항목 적용").click());
      const staged = stage.mock.calls.at(-1)![0] as CompanyInfo;
      expect(staged.매출Y1상).toBe("120");
      expect(staged.매출Y1하).toBe("130");
      expect(staged.매출Y2상).toBe("80");
      expect(staged.과년도매출).toBe("250");
      expect(staged.과년도매출Y2).toBe("170");
      expect(staged.매출증가율Y2Y1).toBe("+47.1%"); // (250 − 170) ÷ 170
      expect(staged.반기별매출).toBe("");
      expect(staged.매출기준연도).toBe("2026"); // 기준 연도가 없던 업체 — 파서가 칸을 고른 해를 함께
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CompanyDocAutofillDialog — 리뷰 회귀", () => {
  it("충돌 행에서 다른 값을 고르면 안내 문구도 그 값 기준으로 바뀐다", async () => {
    // 지금 개업일 = 개인 사업자등록증 값(20.03.02). 법인 문서는 19.07.15.
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({ 개업일: "20.03.02" }), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("a.png"));
    ocrText.value = CORP_CERT;
    await pickFiles(png("b.png"));
    const pick = document.querySelector<HTMLSelectElement>('select[aria-label="개업일 값 고르기"]')!;
    const row = () => document.querySelector('[data-row="개업일"]')!.textContent ?? "";
    const other = [...pick.options].find((o) => !o.text.startsWith("20.03.02"))!;
    const same = [...pick.options].find((o) => o.text.startsWith("20.03.02"))!;
    await act(async () => {
      pick.value = same.value;
      pick.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(row()).toContain("지금 값과 같아요");
    await act(async () => {
      pick.value = other.value;
      pick.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(row()).toContain("지금 값이 있어 기본으로 안 덮어요");
    expect(row()).not.toContain("지금 값과 같아요");
  });

  it("포커스가 바깥(body)에 있어도 Esc 로 닫힌다", () => {
    const onClose = vi.fn();
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose }));
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("모르는 문서는 종류를 골라 달라고 안내한다", async () => {
    ocrText.value = "아무 글자나 적힌 메모";
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("memo.png"));
    expect(document.body.textContent).toContain("어떤 서류인지 알아보지 못했어요");
    expect(document.body.textContent).not.toContain("곧 지원돼요");
  });

  it("라이브러리 오류 원문은 보이지 않고 쉬운 안내만", async () => {
    runDocumentOcr.mockImplementationOnce(async () => {
      throw new Error("Invalid PDF structure");
    });
    mount(h(CompanyDocAutofillDialog, { current: CompanyInfo.parse({}), onApply: vi.fn(), onClose: vi.fn() }));
    await pickFiles(png("bad.png"));
    const alert = document.querySelector('[role="alert"]')!.textContent ?? "";
    expect(alert).toContain("이 파일은 읽지 못했어요");
    expect(alert).not.toContain("Invalid");
  });
});
