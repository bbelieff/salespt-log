// @vitest-environment jsdom
/** 조건 대기 입력·표시 + 업체 장기관리 토글·칩 화면(2026-10-23 belie). 이름은 합성. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractPayment, PaymentSlot } from "@/types";
import LongTermToggle from "@/app/(app)/payment/_components/LongTermToggle";
import PaymentSortControl from "@/app/(app)/payment/_components/PaymentSortControl";
import ProgressWaitFields, { WaitBadge } from "@/app/(app)/payment/_components/ProgressWaitFields";
import ContractListTable from "@/app/(app)/payment/_components/ContractListTable";
import { buildCompanyWorkItems } from "@/app/(app)/payment/_lib/company-work-view";
import { buildInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";
import { contract, slot } from "./follow-ups-factories";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/app/(app)/payment/_components/MeetingLinkPicker", () => ({ default: () => null }));

let root: Root | undefined;
let el: HTMLDivElement | undefined;
function render(node: React.ReactElement) {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root!.render(node));
  return el;
}
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });
const buttons = (c: HTMLElement) => [...c.querySelectorAll("button")];

describe("업체 상태 토글", () => {
  it("현재 값이 눌려 있고, 다른 쪽을 누를 때만 바꾼다", () => {
    const onChange = vi.fn();
    const c = render(h(LongTermToggle, { value: "진행", onChange }));
    const [run, long] = buttons(c);
    expect(run!.getAttribute("aria-pressed")).toBe("true");
    act(() => run!.click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => long!.click());
    expect(onChange).toHaveBeenCalledWith("장기관리");
    // 배너 옆 다른 버튼과 같은 작은 크기(20px 버튼 · 10px 글씨).
    expect(long!.className).toContain("h-5");
    expect(long!.className).toContain("text-px-10");
  });
});

describe("정렬 줄 — 장기관리 칩은 없앴다(목록 맨 아래 묶음으로, 2026-10-31)", () => {
  it("정렬 버튼만", () => {
    const c = render(h(PaymentSortControl, { value: "dday", onChange: () => {} }));
    expect(buttons(c).map((b) => b.textContent)).toEqual(["등록 빠른순", "등록 늦은순", "D-day순"]);
  });
});

describe("조건 대기 입력", () => {
  it("사유 + 단기/장기관리 칩, 고르면 기간을 바꾼다", () => {
    const onChange = vi.fn();
    const s: PaymentSlot = slot({ 진행률: "조건 대기", 대기사유: "담보 설정 완료 기다림" });
    const c = render(h(ProgressWaitFields, { slot: s, onChange }));
    expect(c.querySelector<HTMLInputElement>("input")!.value).toBe("담보 설정 완료 기다림");
    const [short, long] = buttons(c);
    expect(short!.textContent).toBe("단기관리 (2개월 내)");
    expect(short!.getAttribute("aria-pressed")).toBe("true"); // 기간 미선택 = 단기
    act(() => long!.click());
    expect(onChange).toHaveBeenCalledWith({ 대기사유: "담보 설정 완료 기다림", 대기기간: "장기" });
    expect(c.textContent).not.toMatch(/다시 볼|2주|석 달/);
  });

  it("표시 배지는 조건 대기일 때만", () => {
    const c = render(h("div", null, h(WaitBadge, { slot: slot({ 진행률: "조건 대기", 대기기간: "장기" }) }), h(WaitBadge, { slot: slot({ 진행률: "중도중지" }) })));
    expect(c.textContent).toBe("조건 대기 · 장기관리");
  });

  it("업체 목록 카드에 「조건 대기 · 단기관리」 + 사유", () => {
    const rows: ContractPayment[] = [contract({ 수납1: slot({ 진행기관: "기관A", 진행률: "조건 대기", 대기사유: "보증서 발급 기다림", 대기기간: "단기" }) })];
    const c = render(h(ContractListTable, { items: buildCompanyWorkItems(rows, buildInstitutionWorkItems(rows)), selectedKey: null, onSelect: () => {} }));
    expect(c.querySelector("[data-payment-wait-badge]")?.textContent).toBe("조건 대기 · 단기관리");
    expect(c.textContent).toContain("사유: 보증서 발급 기다림");
  });
});

describe("실무/수납 화면 연결", () => {
  const page = readFileSync(join(process.cwd(), "app/(app)/payment/page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "app/(app)/payment/_components/PaymentSlotForm.tsx"), "utf8");
  it("장기관리 업체는 목록 맨 아래 접힌 묶음, 배너는 장기관리면 호박색 + 「기본 너비」 옆 토글", () => {
    expect(page).toContain("<LongTermFold count={longCompanyItems.length}");
    expect(page).toContain("startIndex={activeCompanyItems.length}");
    expect(page).toContain("const companyItems = [...activeCompanyItems, ...longCompanyItems];");
    expect(page).toMatch(/기본 너비<\/button>\{stageToggle\(selectedCp\)\}/);
    expect(page).toContain("from-amber-100/95");
    // 상세 초안 저장이 토글 값을 되돌리지 않는다.
    expect(page).toContain("관리상태: saved.관리상태, 관리상태진행건: saved.관리상태진행건");
  });
  it("진행률 목록: % 다음 조건 대기, 그다음 중도중지 · 중도중지는 추가 입력 없음", () => {
    expect(form).toContain('"100%", WAITING_PROGRESS, HALTED_PROGRESS]');
    expect(form).toContain("{waiting && <ProgressWaitFields");
  });
  it("기간 칩은 고르는 즉시 저장(글자 칸처럼 칸을 떠날 때까지 기다리지 않는다)", () => {
    const row = readFileSync(join(process.cwd(), "app/(app)/payment/_components/ContractRow.tsx"), "utf8");
    expect(row).toContain("next.진행률 === prev.진행률 && next.대기기간 === prev.대기기간");
  });
});
