// @vitest-environment jsdom
/**
 * 업체정보 기본보기 / 확장보기 + 계정 보관함 삭제(belie 2026-10-09).
 * 기본보기 = 계약 전에 필요한 칸만, 컨택가이드 순서. 실무/수납(CompanyInfoContractSection)은 확장보기가 기본.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import { CompanyInfo } from "@/types";
import { 기본_대표자_ITEMS, 기본_사업자_ITEMS, 기업정보_ITEMS, 대표자_ITEMS, 재무_ITEMS } from "@/components/company-info-defs";
import { hiddenFilledCount } from "@/components/company-info/view-filter";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { initial: unknown }) => ({
    draft: opts.initial, saved: opts.initial, status: "idle", error: "", dirty: false, savedAt: null, canUndo: false,
    update: vi.fn(), stage: vi.fn(), commit: vi.fn(), syncServer: vi.fn(), retry: vi.fn(), flush: vi.fn(), undo: vi.fn(),
  }),
}));
let host: HTMLDivElement;
let root: Root | null = null;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});
const render = (value: Partial<CompanyInfo>, defaultLayout?: "basic" | "extended") =>
  act(() => {
    root = createRoot(host);
    root.render(React.createElement(CompanyInfoEditor, { value: CompanyInfo.parse(value), onSave: () => undefined, hideSave: true, defaultLayout }));
  });
const labels = (group: string) =>
  [...host.querySelectorAll(`[role=group][aria-label="${group}"] label`)].map((l) => (l.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);

describe("기본보기 — 컨택가이드 순서", () => {
  it("대표자: 이름 · 신용점수 · 기대출 개인 / 사업자: 개업일 … 기타메모", () => {
    render({});
    expect(labels("대표자")).toEqual(["이름", "신용점수(KCB/NCB)", "기대출 개인"]);
    const biz = labels("사업자").map((l) => l.replace(/ 매출 Y.*$/, ""));
    expect(biz).toEqual([
      "개업일", "사업자구분 · 과세유형", "업종", "주요품목",
      expect.stringMatching(/^올해 \d{4}/), expect.stringMatching(/^Y-1 /), expect.stringMatching(/^Y-2 /), expect.stringMatching(/^Y-3 /),
      "사업자 대출", "4대보험 직원", "특허 및 인증", "소재지", "기타메모",
    ]);
    // 확장 전용 칸은 없다.
    expect(host.querySelector('[role=group][aria-label="재무"]')).toBeNull();
    expect(host.textContent).not.toContain("주민등록번호");
  });

  it("연매출은 연도 합계 4칸만 — 반기가 있으면 읽기 전용 자동 합계", () => {
    render({ 금년도매출: "68", 매출Y1상: "50", 매출Y1하: "70" });
    const inputs = [...host.querySelectorAll<HTMLInputElement>("[data-sales-totals] input")];
    expect(inputs.map((i) => i.value)).toEqual(["68", "120", "", ""]);
    expect(inputs[1]!.readOnly).toBe(true);
  });

  it("기본보기에서 안 보이는데 적힌 칸이 있으면 알리고, 누르면 확장보기", () => {
    render({ 대표자이름: "김가상", 자택주소지: "가상", 결산연도: "2025" });
    const more = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("확장보기에 적힌 항목"))!;
    expect(more.textContent).toContain("2개");
    act(() => more.click());
    expect(host.querySelector('[role=group][aria-label="재무"]')).not.toBeNull();
    expect(localStorage.getItem("salespt:company-info-layout:basic")).toBe("extended");
  });

  it("hiddenFilledCount 는 기본보기 칸을 세지 않는다", () => {
    const ci = CompanyInfo.parse({ 대표자이름: "a", 소재지: "b", 주민등록번호: "900101" });
    expect(hiddenFilledCount([대표자_ITEMS, 기업정보_ITEMS, 재무_ITEMS], [기본_대표자_ITEMS, 기본_사업자_ITEMS], ci)).toBe(1);
  });
});

describe("화면별 기본값", () => {
  it("extended 로 열면 지금 전체 화면 + 보기 거르기", () => {
    render({}, "extended");
    expect(host.querySelector('[role=group][aria-label="재무"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="업체정보 보기"]')).not.toBeNull();
  });
  it("기본보기에는 「전체/적은 것/안 적은 것」 거르기가 없다", () => {
    render({});
    expect(host.querySelector('[aria-label="업체정보 보기"]')).toBeNull();
  });
  it("실무/수납(계약 후)은 확장보기, 컨택·일정계약은 기본보기", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(read("components/CompanyInfoContractSection.tsx")).toContain('defaultLayout="extended"');
    expect(read("app/(app)/contact/_components/MeetingSlotItem.tsx")).not.toContain("defaultLayout");
    expect(read("app/(app)/schedule/_components/MeetingResultCard.tsx")).not.toContain("defaultLayout");
  });
});

describe("계정 보관함 삭제", () => {
  it("삭제는 기다리지 않고 바로 저장 + 되돌리기, 버튼은 손가락 크기", () => {
    const src = readFileSync(join(process.cwd(), "components/company-info/CompanyVaultSection.tsx"), "utf8");
    expect(src).toContain("onClick={() => remove(i)}");
    expect(src).toMatch(/const remove = \(i: number\) => \{[\s\S]*?save\(next\);/);
    expect(src).toContain("되돌리기");
    expect(src).toContain("h-8 shrink-0 rounded-md border");
  });
  it("아이디|비밀번호 한 줄 + 보기만(복사 없음), 메모 칸·잠금 저장 배지·지금 잠그기 없음, 열림 30분", () => {
    const src = readFileSync(join(process.cwd(), "components/company-info/CompanyVaultSection.tsx"), "utf8");
    expect(src).not.toContain(">복사<");
    expect(src).not.toContain("복사됨");
    expect(src).not.toContain(">잠금 저장<");
    expect(src).not.toContain(">지금 잠그기<");
    expect(src).toContain("{it.note.trim() && (");
    expect(src).toContain("· 열림 · <span");
    const types = readFileSync(join(process.cwd(), "lib/types/company-vault.ts"), "utf8");
    expect(types).toContain("VAULT_UNLOCK_MS = 30 * 60 * 1000");
  });
});
