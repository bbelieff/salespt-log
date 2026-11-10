// @vitest-environment jsdom
/**
 * 업체정보 [대표자] 이메일 칸 (company-info-email-v2, 2026-11-10).
 *  - 확장보기에만, 연락처/통신사 바로 아래 · 기본보기에는 없음(적혀 있으면 「확장보기에 적힌 항목」에 셈)
 *  - 기본↔확장 전환은 저장을 만들지 않는다
 *  - 칸: blur 정리(tidyContactEmail) · 모양이 아니면 amber 안내만(막지 않음) · 모바일 @ 키보드
 *  - 미팅 메모 자동입력 · TXT 줄 · 순수 유틸
 * 합성 데이터만.
 */
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const autosave = { update: vi.fn(), stage: vi.fn(), commit: vi.fn(), flush: vi.fn() };
vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { initial: unknown }) => ({
    draft: opts.initial, saved: opts.initial, status: "idle", error: "", dirty: false, savedAt: null, canUndo: false,
    syncServer: vi.fn(), retry: vi.fn(), undo: vi.fn(), ...autosave,
  }),
}));

import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CompanyInfoField, { EMAIL_SHAPE_MSG } from "@/components/company-info/CompanyInfoField";
import { EMAIL_HINT, companyInfoFieldList } from "@/components/company-info-defs";
import { CompanyInfo } from "@/types";
import { parseMeetingMemo } from "@/lib/document-ocr/parse-memo";
import { formatCompanyInfoTxt } from "@/service/company-info-txt";
import { looksLikeContactEmail, tidyContactEmail } from "@/util/contact-email";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root | null = null;
beforeEach(() => {
  localStorage.clear();
  for (const f of Object.values(autosave)) f.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

const onSave = vi.fn();
const renderEditor = (value: Partial<CompanyInfo>, defaultLayout?: "basic" | "extended") =>
  act(() => {
    root = createRoot(host);
    root.render(React.createElement(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave, hideSave: true, defaultLayout }));
  });
const labels = (group: string) =>
  [...host.querySelectorAll(`[role=group][aria-label="${group}"] label`)].map((l) => (l.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
const layoutButton = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('[aria-label="업체정보 보기 범위"] button')].find((b) => b.textContent === name)!;

describe("편집기 — 확장보기에만", () => {
  it("확장보기: 연락처/통신사 바로 다음이 이메일 · 모바일 @ 키보드", () => {
    renderEditor({}, "extended");
    const l = labels("대표자");
    expect(l[l.indexOf("연락처/통신사") + 1]).toBe("이메일");
    const input = [...host.querySelectorAll<HTMLInputElement>("input")].find((i) => i.id.endsWith("이메일"))!;
    expect(input.inputMode).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.type).toBe("text");
  });

  it("기본보기에는 없고, 적혀 있으면 「확장보기에 적힌 항목」에 센다", () => {
    renderEditor({ 이메일: "ceo@example.com" });
    expect(labels("대표자")).not.toContain("이메일");
    const more = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("확장보기에 적힌 항목"))!;
    expect(more.textContent).toContain("1개");
  });

  it("기본↔확장 전환은 저장을 만들지 않는다", () => {
    renderEditor({ 이메일: "ceo@example.com", 대표자이름: "홍길동" });
    act(() => layoutButton("확장보기").click());
    expect(labels("대표자")).toContain("이메일");
    act(() => layoutButton("기본보기").click());
    act(() => layoutButton("확장보기").click());
    for (const f of Object.values(autosave)) expect(f).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("자동입력 비교표 순서 목록에도 연락처 다음으로 들어간다", () => {
    const keys = companyInfoFieldList(2026).map(([k]) => k);
    expect(keys[keys.indexOf("연락처통신사") + 1]).toBe("이메일");
  });
});

describe("이메일 칸", () => {
  const renderField = (value: string, onChange = vi.fn()) => {
    act(() => {
      root = createRoot(host);
      root.render(React.createElement(CompanyInfoField, { def: ["이메일", "이메일", EMAIL_HINT, 2], value, onChange, id: "t-이메일" }));
    });
    return { onChange, input: host.querySelector("input")! };
  };

  it("blur 에 공백·전각 ＠·mailto: 를 정리(대소문자 유지)", () => {
    const { onChange, input } = renderField(" mailto:CEO ＠ Example.com ");
    act(() => { input.focus(); input.blur(); });
    expect(onChange).toHaveBeenCalledWith("이메일", "CEO@Example.com");
  });

  it("이미 정리된 값·빈 값은 blur 해도 onChange 없음", () => {
    const a = renderField("ceo@example.com");
    act(() => { a.input.focus(); a.input.blur(); });
    expect(a.onChange).not.toHaveBeenCalled();
  });

  it("모양이 아니면 amber 안내만 — 값은 그대로", () => {
    renderField("ceo.example.com");
    expect(host.querySelector('[role=status]')?.textContent).toBe(EMAIL_SHAPE_MSG);
    expect(host.querySelector("input")!.value).toBe("ceo.example.com");
  });

  it("바른 값·빈 값은 안내 없음", () => {
    renderField("a@b.co");
    expect(host.querySelector('[role=status]')).toBeNull();
  });
});

describe("미팅 메모 자동입력", () => {
  it("이메일 라벨 → 이메일 칸 제안(대표 분기보다 먼저)", () => {
    const res = parseMeetingMemo("● 대표 이메일\t\tceo＠example.com\n● 대표자\t\t홍길동");
    expect(res.fields.find((f) => f.key === "이메일")).toMatchObject({ value: "ceo@example.com", valid: true });
    expect(res.fields.find((f) => f.key === "대표자이름")?.value).toBe("홍길동");
    expect(res.info?.find((i) => i.label === "이메일")).toBeUndefined();
  });

  it("E-mail 라벨도 · 모양이 아니면 valid:false(기본 체크 안 함)", () => {
    const res = parseMeetingMemo("● E-mail\t\tceo.example.com");
    expect(res.fields.find((f) => f.key === "이메일")).toMatchObject({ value: "ceo.example.com", valid: false });
  });

  it("계정 라벨(이메일 ID/PW)은 칸이 아니라 보관함", () => {
    const res = parseMeetingMemo("● 이메일 ID/PW\t\tceo@example.com / Pw1234!");
    expect(res.fields.find((f) => f.key === "이메일")).toBeUndefined();
    expect(res.vault.length).toBe(1);
  });
});

describe("TXT 내보내기", () => {
  it("연락처 바로 다음 줄 · 비면 줄 생략", () => {
    const txt = formatCompanyInfoTxt("예시상사", CompanyInfo.parse({ 연락처통신사: "010-0000-0000(SKT)", 이메일: "ceo@example.com", 기대출개인: "없음" }), "2026-11-10 10:00");
    const lines = txt.split("\n");
    const i = lines.findIndex((l) => l.includes("연락처/통신사"));
    expect(lines[i + 1]).toMatch(/^● 이메일\s+ceo@example\.com$/);
    expect(formatCompanyInfoTxt("예시상사", CompanyInfo.parse({ 연락처통신사: "010" }), "2026-11-10 10:00")).not.toContain("이메일");
  });
});

describe("contact-email 유틸", () => {
  it("tidy / looksLike", () => {
    expect(tidyContactEmail("  a ＠ b．co ")).toBe("a@b.co");
    expect(tidyContactEmail("a @ b @ c")).toBe("a @ b @ c");
    expect(looksLikeContactEmail("")).toBe(true);
    expect(looksLikeContactEmail("a@b.co, c@d.kr")).toBe(true);
    expect(looksLikeContactEmail("a@b")).toBe(false);
    expect(looksLikeContactEmail("@카톡")).toBe(false);
  });
});
